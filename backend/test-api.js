// Using native global fetch (Node 18+)

async function runTests() {
  const baseUrl = 'http://localhost:5000';
  
  console.log('--- Testing /health ---');
  try {
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log('Health response:', healthData);
  } catch (err) {
    console.error('Health request failed:', err.message);
  }

  console.log('\n--- Testing POST /api/jobs (Invalid URL) ---');
  try {
    const badPostRes = await fetch(`${baseUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtubeUrl: 'https://google.com' })
    });
    console.log('Bad POST status:', badPostRes.status);
    const badPostData = await badPostRes.json();
    console.log('Bad POST response:', badPostData);
  } catch (err) {
    console.error('Bad POST request failed:', err.message);
  }

  console.log('\n--- Testing POST /api/jobs (Valid URL) ---');
  let jobUuid = '';
  try {
    const postRes = await fetch(`${baseUrl}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    });
    console.log('POST status:', postRes.status);
    const postData = await postRes.json();
    console.log('POST response:', postData);
    jobUuid = postData.id;
  } catch (err) {
    console.error('POST request failed:', err.message);
  }

  if (jobUuid) {
    console.log(`\n--- Testing GET /api/jobs/${jobUuid} ---`);
    try {
      const getRes = await fetch(`${baseUrl}/api/jobs/${jobUuid}`);
      console.log('GET status:', getRes.status);
      const getData = await getRes.json();
      console.log('GET response:', getData);
    } catch (err) {
      console.error('GET request failed:', err.message);
    }

    console.log('\n--- Testing GET /api/jobs/00000000-0000-0000-0000-000000000000 (Non-existent UUID) ---');
    try {
      const getRes = await fetch(`${baseUrl}/api/jobs/00000000-0000-0000-0000-000000000000`);
      console.log('GET status:', getRes.status);
      const getData = await getRes.json();
      console.log('GET response:', getData);
    } catch (err) {
      console.error('GET request failed:', err.message);
    }

    console.log('\n--- Testing GET /api/jobs/invalid-uuid-format (Invalid UUID format) ---');
    try {
      const getRes = await fetch(`${baseUrl}/api/jobs/invalid-uuid-format`);
      console.log('GET status:', getRes.status);
      const getData = await getRes.json();
      console.log('GET response:', getData);
    } catch (err) {
      console.error('GET request failed:', err.message);
    }
  } else {
    console.log('\nSkipping GET test because POST failed to return a UUID.');
  }
}

runTests();
