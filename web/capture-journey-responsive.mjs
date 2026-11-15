import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const mode = process.env.CAPTURE_MODE || 'short';
if (!['short','narrow'].includes(mode)) throw Error('Use CAPTURE_MODE=short or narrow.');
const dir = path.resolve('../artifacts/roamy-seoul/design/journey-refinement');
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:mode==='short'?960:360,height:480},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.TEST_BASE_URL || 'http://localhost:5174');
await expect(page.locator('canvas')).toBeVisible();
if(mode==='short'){
 await page.getByRole('button',{name:/Collection/}).click();
 await page.getByRole('button',{name:/Gwangjang Market flavors/}).click();
 await page.getByRole('button',{name:'Edit note',exact:true}).click();
 await page.getByRole('textbox',{name:'Memory note',exact:true}).fill('서울 — a short-screen market memory.');
 await page.getByRole('button',{name:'Save note',exact:true}).click();
 await expect(page.locator('.memory-quote')).toBeFocused();
 await expect(page.locator('.memory-quote')).toHaveText('“서울 — a short-screen market memory.”');
}
await page.waitForTimeout(350);
const file=mode==='short'?'responsive-01-short-saved-quote.png':'responsive-02-narrow-header.png';
await page.screenshot({path:path.join(dir,file)});
await fs.writeFile(path.join(dir,`${mode}-responsive-state.json`),JSON.stringify({file,viewport:page.viewportSize(),source:'Actual current production browser UI; no saved world injection',reducedMotion:'reduce',assets:await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('/assets/'))),dom:await page.locator('main').innerText(),pageErrors:errors,inspected:false},null,2)+'\n');
await browser.close();console.log(file);
