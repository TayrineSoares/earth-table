import '../styles/Home.css'
import { useState, useEffect } from 'react';
import loadingAnimation from '../assets/loading.json';
import Lottie from 'lottie-react';
import { Link } from "react-router-dom";
import headerImage from "../assets/images/headerImage.png"
import logoNoBackground from "../assets/images/logoNoBackground.png"


const Home = () => {
  const [homepageCategories, setHomepageCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);


   useEffect(() => {
    fetch('http://localhost:8080/categories/homepage')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP Error.${res.status}`);
        }
        return res.json()
      }) 
      .then(data => {
        setHomepageCategories(data);
        setIsLoading(false);
      })
      .catch((err) => console.error(err));
  }, []); 

  return (
    <div className="homepage">
      <div className="header-images">
        <img src={headerImage} className="header-image" alt="Background" />
        <img src={logoNoBackground} className="logo-no-background" alt="Logo" />
        <div className="logo-text">Creating Nourishing Experiences that Support your Health Journey</div>
      </div>

      <div className="page-wrapper">

          {isLoading ? (
            <div className="loading-container">
              <Lottie animationData={loadingAnimation} loop={true} />
            </div>
          ) : (
            homepageCategories.map((category, index) => (
              <section className="zigzag-section" key={category.id}>
                <div className={`zigzag-content ${index % 2 !== 0 ? 'reverse' : ''}`}>
                  <div className="zigzag-text">
                    <h2 className="category-title">{category.name}</h2>
                    <div className="category-description-container">
                      <p className="category-description">{category.description}</p>
                    </div>
                    <div className="shop-button-container">
                      <Link to={`/products/${category.id}`}>
                        <button className="shop-button">Shop Now</button>
                      </Link>
                    </div>
                  </div>
      
                  <div className="zigzag-image">
                    <img src={category.image_url} alt="Section 1" />
                  </div>
                </div>
              </section>
            ))
            )}
          
      </div>
    </div>
  )
};

export default Home;
