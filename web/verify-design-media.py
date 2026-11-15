from pathlib import Path
import subprocess,json,hashlib
base=Path(__file__).resolve().parents[1]/'artifacts/roamy-seoul/design';frames=base/'verified-frames';frames.mkdir(exist_ok=True)
result={'method':'Actual continuous Playwright screen recording; silent H264 conversion at 15fps; no speed alteration or trimming. Full files decoded before frame review. Frame inspection notes are appended after viewing.','videos':[]}
for name,nums in [('main',[1,3,7,8,14]),('short',[2,6,8,9]),('narrow',[1,2,5])]:
 p=base/f'{name}-walkthrough.mp4';raw=base/f'{name}-walkthrough.webm';m=json.loads((base/f'{name}-manifest.json').read_text())
 def probe(x):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(x)]))
 info=probe(p);orig=probe(raw);v=next(x for x in info['streams'] if x['codec_type']=='video')
 subprocess.run(['ffmpeg','-v','error','-threads','2','-i',str(p),'-f','null','-'],check=True)
 r={'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'codec':v['codec_name'],'width':v['width'],'height':v['height'],'frameRate':v['avg_frame_rate'],'durationSeconds':float(info['format']['duration']),'rawDurationSeconds':float(orig['format']['duration']),'hasAudio':any(s['codec_type']=='audio' for s in info['streams']),'fullDecode':'passed','productionAssets':m['productionAssets'],'frames':[]}
 for n in nums:
  s=m['steps'][n-1];t=min(s['videoSeconds']+.15,r['durationSeconds']-.2);f=f'{name}-{n:02}-decoded.png'
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(p),'-frames:v','1',str(frames/f)],check=True)
  r['frames'].append({'file':f'verified-frames/{f}','timestampSeconds':t,'sourceScreenshot':s['file'],'inspected':False})
 result['videos'].append(r)
(base/'media-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps([{k:v[k] for k in ['file','bytes','durationSeconds','rawDurationSeconds','width','height']} for v in result['videos']],indent=2))
