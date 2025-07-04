import '../styles/Home.css'
import { useState, useEffect } from 'react';


const Home = () => {
  const [homepageCategories, setHomepageCategories] = useState([]); 

   useEffect(() => {
    fetch('http://localhost:8080/categories/homepage')
      .then((res) => res.json()) // Parse the JSON response
      .then((data) => setHomepageCategories(data))
      .catch((err) => console.error(err));
  }, []); // Empty array = runs only once on mount


  return (
    <div className="homepage">
      <section className="heading">
        <h1>Earth Table</h1>
        <h3>Creating Nourishing Experiences that Support Your Health Journey.</h3>

      </section>

      {/* Zig-Zag Section */}
      {homepageCategories.map((category, index) => (
        <section className="zigzag-section" key={category.id}>
          <div className={`zigzag-content ${index % 2 !== 0 ? 'reverse' : ''}`}>
            <div className="zigzag-text">
              <h2>{category.name}</h2>
              <p>{category.description} </p>
              <button>Shop Now</button>
            </div>

            <div className="zigzag-image">
              <img src={category.image_url} alt="Section 1" />
            </div>
          </div>
        </section>
      )
    )}
    </div>
  )
};

export default Home;
