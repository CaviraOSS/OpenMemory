const URL = 'http://localhost:8080';
const K = 'your-key';
async function comp() {
  const t =
    'I think that in order to effectively implement this feature, we really need to consider that the application should be designed in such a way that it basically provides optimal performance. At this point in time, we should focus on making the function work properly prior to adding additional features.';
  const r = await fetch(`${URL}/api/compression/compress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(K && { 'x-api-key': K }),
    },
    body: JSON.stringify({ text: t, algorithm: 'semantic' }),
  });
  const d = await r.json();
  console.log('Comp:', d.comp);
  console.log('M:', d.m);
  console.log(`Saved ${d.m.saved} (${d.m.pct.toFixed(2)}%)`);
  console.log(`Lat: ${d.m.latency.toFixed(2)}ms`);
}
async function auto() {
  const t =
    'function processData(data) {return data.map(item => ({id: item.id,name: item.name,value: item.value}));}';
  const r = await fetch(`${URL}/api/compression/compress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(K && { 'x-api-key': K }),
    },
    body: JSON.stringify({ text: t }),
  });
  const d = await r.json();
  console.log('Algo:', d.m.algo);
  console.log('Og:', d.m.ogTok);
  console.log('Comp:', d.m.compTok);
  console.log('Ratio:', (d.m.ratio * 100).toFixed(2) + '%');
}
async function batch() {
  const ts = [
    'This is a really very long sentence that could be compressed significantly.',
    'At this point in time, we need to implement the feature.',
    'Due to the fact that performance is important, we should optimize.',
  ];
  const r = await fetch(`${URL}/api/compression/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(K && { 'x-api-key': K }),
    },
    body: JSON.stringify({ texts: ts, algorithm: 'semantic' }),
  });
  const d = await r.json();
  console.log('Results:', d.results.length);
  console.log('Total:', d.total);
  d.results.forEach((x, i) => {
    console.log(`\nT${i + 1}:`);
    console.log('Comp:', x.comp);
    console.log('Saved:', x.m.saved);
  });
}
async function analyze() {
  const t =
    'In order to achieve optimal performance in the application, it is really important that we should basically focus on the implementation details. At this point in time, the code base could actually benefit from some refactoring due to the fact that there is quite a lot of redundancy.';
  const r = await fetch(`${URL}/api/compression/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(K && { 'x-api-key': K }),
    },
    body: JSON.stringify({ text: t }),
  });
  const d = await r.json();
  console.log('\nAnalysis:');
  for (const [a, m] of Object.entries(d.analysis)) {
    console.log(`\n${a.toUpperCase()}:`);
    console.log(`Og: ${m.ogTok}`);
    console.log(`Comp: ${m.compTok}`);
    console.log(`Saved: ${m.saved} (${m.pct.toFixed(2)}%)`);
    console.log(`Lat: -${m.latency.toFixed(2)}ms`);
  }
  console.log('\n REC:', d.rec.algo);
  console.log(`Save: ${d.rec.save}`);
  console.log(`Lat: ${d.rec.lat}`);
}
async function stats() {
  const r = await fetch(`${URL}/api/compression/stats`, {
    method: 'GET',
    headers: { ...(K && { 'x-api-key': K }) },
  });
  const d = await r.json();
  console.log('\n STATS:');
  console.log('Total:', d.stats.total);
  console.log('OgTok:', d.stats.ogTok);
  console.log('CompTok:', d.stats.compTok);
  console.log('Saved:', d.stats.saved);
  console.log('SavedPct:', d.stats.totalPct);
  console.log('AvgRatio:', d.stats.avgRatio);
  console.log('Lat:', d.stats.lat);
  console.log('AvgLat:', d.stats.avgLat);
  console.log('\nAlgos:');
  for (const [a, c] of Object.entries(d.stats.algos)) {
    console.log(`${a}: ${c}`);
  }
}
async function addMem() {
  const c =
    'I really think that it is very important that we basically need to ensure that the user experience is optimized at this point in time. In order to accomplish this goal, we should focus on implementing features that will actually improve the overall performance of the application.';
  const r = await fetch(`${URL}/memory/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(K && { 'x-api-key': K }),
    },
    body: JSON.stringify({
      content: c,
      tags: ['feat', 'ux'],
      metadata: { pri: 'high' },
    }),
  });
  const d = await r.json();
  console.log('Mem:', d.id);
  if (d.comp) {
    console.log('\n COMP:');
    console.log(`Saved: ${d.comp.saved} (${d.comp.pct})`);
    console.log(`Lat: ${d.comp.lat}`);
    console.log(`Algo: ${d.comp.algo}`);
  }
}
export { comp, auto, batch, analyze, stats, addMem };
