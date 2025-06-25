import './App.css'
import { useState, useEffect } from 'react';


const App = () => {

  const [data, setData] = useState([]);

  useEffect(() => {
    // Fetch data from the backend API
    fetch('http://localhost:8080/fakedata')
      .then(res => res.json()) // Convert the response to JSON
      .then(setData) // Update state
      .catch(err => console.log('Fetch error:', err));
  }, []);  // Empty dependency array = run only once on mount

  return (
    <>
      <h1>Earth Table</h1>
      {data.map(item => (
        <div key={item.id}>
          <h2>{item.title}</h2>
          <p>{item.instructions}</p>
        </div>
      ))}
    </>
  );
}

export default App;