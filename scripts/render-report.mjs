/** Generate the actual report artifact, using the same report page as the website. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '../tooling/pdf/node_modules/playwright/index.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const at=x.indexOf('=');return [x.slice(0,at),x.slice(at+1)]}));
const root=path.resolve(import.meta.dirname,'..');
const receipt=await fs.readFile(path.join(root,'work/receipt.json'),'utf8').then(JSON.parse).catch(()=>null);
const base=args['--url'] || 'https://web3-market-center.raymondhuangj.chatgpt.site';
const snapshot=args['--snapshot'] || receipt?.snapshotId;
if(!snapshot && !base.startsWith('http://localhost:')) throw Error('A published snapshot receipt is required');
const output=args['--output'] || path.join(root,'work/web3-market-report.pdf');
const reportURL=base+'/report'+(snapshot?'?snapshot='+encodeURIComponent(snapshot):'');
await fs.mkdir(path.dirname(output),{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PDF_CHROMIUM_PATH?{executablePath:process.env.PDF_CHROMIUM_PATH}:{})});
try {
  const context=await browser.newContext({viewport:{width:1120,height:900},locale:'zh-CN',timezoneId:'Asia/Shanghai',userAgent:'Web3MarketDataCenter/2.0 (+https://github.com/raymondhuang1994/web3-market-data-center)'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(reportURL,{waitUntil:'domcontentloaded',timeout:120000});
  if(!response?.ok()) throw Error('Report page failed: '+response?.status());
  await page.locator('[data-report-ready="true"]').waitFor({timeout:120000});
  const manifest=JSON.parse(await page.locator('#report-manifest').textContent());
  if(snapshot && manifest.snapshotId!==snapshot) throw Error('Mixed snapshot');
  if(receipt?.analysisHash && manifest.analysisHash!==receipt.analysisHash) throw Error('Mixed analysis');
  if(receipt?.analysisHash && await page.locator('[data-analysis-point]').count()<4) throw Error('Missing Codex commentary');
  const actualSections=await page.locator('[data-report-section]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-report-section')));
  const panelCount=await page.locator('[data-report-panel]').count();
  if(JSON.stringify(actualSections)!==JSON.stringify(manifest.sectionKeys) || panelCount!==manifest.panels) throw Error('Incomplete report scope');
  if(manifest.routes!==13 || manifest.sectors.length!==28) throw Error('Missing routes or sectors');
  const chartCount=await page.locator('svg.recharts-surface').count();
  if(chartCount<10) throw Error('Charts did not render');
  if(errors.length) throw Error('Report rendering error: '+errors.join('; '));
  await page.pdf({path:output,format:'A4',landscape:true,printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,tagged:true,outline:true,
    headerTemplate:'<span></span>',footerTemplate:`<div style="width:100%;padding:0 40px;font-size:8px;color:#64748b;font-family:Arial"><span>Web3 Market Data Center | ${manifest.generatedAt.slice(0,10)} | ${String(manifest.snapshotId).slice(0,12)}</span><span style="float:right"><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`});
  const bytes=await fs.readFile(output);if(bytes.length<30000 || bytes.length>20*1024*1024)throw Error('Unexpected PDF size');
  const result={...manifest,pdfBytes:bytes.length,chartCount,renderedAt:new Date().toISOString(),reportURL};
  await fs.writeFile(output.replace(/\.pdf$/,'.manifest.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({output,bytes:bytes.length,sections:manifest.sections,panels:panelCount,chartCount,snapshotId:manifest.snapshotId}));
} finally {await browser.close()}
