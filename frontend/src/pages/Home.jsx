import '../styles/Home.css';
import { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import headerImage from "../assets/images/headerImage.webp";
import logoNoBackground from "../assets/images/logoNoBackground.png";
import arrow from  "../assets/images/arrow.png"
import { sizedImageUrl } from "../helpers/imageHelpers";

const Home = () => {
  const [categories, setCategories] = useState([]);

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
        <div className="logo-text">Organic Meal Delivery Service & Catering</div>
      </div>

      <div className="page-wrapper">
        {homepageCategories.map((category, index) => (
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
                  <img
                    src={sizedImageUrl(category.image_url, 800)}
                    srcSet={`${sizedImageUrl(category.image_url, 800)} 1x, ${sizedImageUrl(category.image_url, 1600)} 2x`}
                    alt={category.name}
                  />
                </div>
              </div>
            </section>
          ))}

        {categories.length > 0 && (
          <div className='homepage-footer'>
            <p className='footer-starter-text'>There's plenty more to discover!</p>
            <p className='footer-secondary-text'>Shop our other services such as...</p>

            <div className="footer-category-container">
              {footerCategories.map(category => (
                <div className="footer-category-card" key={category.id}>
                  <img
                    src={sizedImageUrl(category.image_url, 600)}
                    srcSet={`${sizedImageUrl(category.image_url, 600)} 1x, ${sizedImageUrl(category.image_url, 1200)} 2x`}
                    className="footer-category-image"
                    alt={category.name}
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
