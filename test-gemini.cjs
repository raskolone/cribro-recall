async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/gemini/lesson-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notes: 'Dzisiejsza lekcja była z Janem Kowalskim. Przerabialiśmy Present Simple, mowił o wakacjach. Mylił czasowniki nieregularne. Na nastepna lekcje przygotuje opis obrazka.',
        students: [
          { id: '1', name: 'Jan Kowalski', level: 'B1', description: 'Uczeń B1' }
        ]
      })
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch(e) {
    console.error(e);
  }
}
test();
