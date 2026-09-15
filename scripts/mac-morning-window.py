#!/usr/bin/env python3
"""Prevent idle sleep only in the approved 08:25–10:15 HK window on AC power.
macOS's independent scheduled wake is necessary if the computer is asleep.
"""
import datetime as dt, subprocess
now=dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))
start=now.replace(hour=8,minute=25,second=0,microsecond=0)
end=now.replace(hour=10,minute=15,second=0,microsecond=0)
power=subprocess.check_output(['/usr/bin/pmset','-g','batt'],text=True)
if start<=now<end and 'AC Power' in power:
    remaining=max(1,int((end-now).total_seconds()))
    print('Keeping the approved morning window awake on AC power',flush=True)
    subprocess.run(['/usr/bin/caffeinate','-is','-t',str(remaining)],check=True)
