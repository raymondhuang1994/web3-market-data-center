"""Bounded retries for the approved free model; never shorten Retry-After."""
import json,random,time,urllib.error
from oidc_post import PublishError

def generate_with_retry(action,*,clock=time.monotonic,sleep=time.sleep,jitter=lambda:random.uniform(0,10),budget=600):
    start=clock()
    for attempt in range(4):
        try:return action()
        except (PublishError,urllib.error.URLError,TimeoutError) as error:
            retryable=error.retryable if isinstance(error,PublishError) else True
            requested=error.retry_after if isinstance(error,PublishError) else None
            code=error.code if isinstance(error,PublishError) else 'analysis_transport_error'
            delay=max(60*2**attempt+jitter(),requested or 0)
            # Reserve both the OIDC request (30s) and the publish request (120s).
            allowed=retryable and attempt<3 and clock()-start+delay+150<=budget
            print(json.dumps({'event':'analysis_attempt_failed','attempt':attempt+1,'code':code,
                'retryable':retryable,'retryScheduled':allowed,'waitSeconds':round(delay,3) if allowed else None}),flush=True)
            if not allowed:raise
            sleep(delay)
