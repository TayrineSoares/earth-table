import '../styles/Home.css';
import { useState, useEffect } from 'react';
import loadingAnimation from '../assets/loading.json';
import Lottie from 'lottie-react';
import { Link } from "react-router-dom";
import headerImage from "../assets/images/headerImage.png";
import logoNoBackground from "../assets/images/logoNoBackground.png";
import arrow from  "../assets/images/arrow.png"

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP Error. ${res.status}`);
        }
        return res.json();
      }) 
      .then(data => {
        setCategories(data);
        setIsLoading(false);
      })
      .catch((err) => console.error(err));
  }, []);

  const homepageCategories = categories.filter(cat => cat.show_on_homepage);
  const footerCategories = categories.filter(cat => !cat.show_on_homepage).slice(0, 2);

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
                    <Link to={`/products/category/${category.id}`}>
                      <button className="shop-button">Shop Now</button>
                    </Link>
                  </div>
                </div>

                <div className="zigzag-image">
                  <img src={category.image_url} alt={category.name} />
                </div>
              </div>
            </section>
          ))
        )}

        {!isLoading && (
          <div className='homepage-footer'>
            <p className='footer-starter-text'>There's plenty more to discover!</p>
            <p className='footer-secondary-text'>Shop our other services such as...</p>

            <div className="footer-category-container">
              {footerCategories.map(category => (
                <div className="footer-category-card" key={category.id}>
                  <img 
                    src={category.image_url} 
                    className="footer-category-image" 
                  />
                  <h3 className="footer-category-name">{category.name}</h3>
                </div>
              ))}
            </div>
            <div className='explore-button-container'>
              <p className='explore-button-text'>EXPLORE ALL CATEGORIES</p>
              <Link to={`/products/category`}>
                <img 
                  src={arrow}
                  className='homepage-arrow'
                  />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
