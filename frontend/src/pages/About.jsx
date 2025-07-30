import '../styles/About.css'
import aboutHeaderPhoto from "../assets/images/aboutHeaderPhoto.png"
import ownerPicture from "../assets/images/ownerPicture.png"
import signature1 from "../assets/images/signature1.png"
import signature2 from "../assets/images/signature2.png"

const About = () => {
  return (
    <div className="about-page">
      <div className='about-images'>
        <img 
          src={aboutHeaderPhoto}
          className='about-header-photo'
        />
      </div>

      <div className='page-wrapper'>
        <div className='about-content-wrapper'>

        <div className='about-section-details'>
          
          <div className='about-me-text'>
            <h2 className='about-title'>Who we are</h2>
            
            <div className="about-description-row">
              <div className="about-description-container">
              <p className='about-description '>
                At Earth Table, our vision is simple: to nourish people with food that is as wholesome as it is delicious. We specialize in holistic meal prep and personal chef services focused on your well-being and peace of mind. </p>
              <br />

              <p className='about-description'> 
                We are committed to using only the highest-quality ingredients:
    
              </p>
              <ul className="about-description" style={{ listStyleType: "none", paddingLeft: 0 }}>
                    <li> Seed oil free ✔</li>
                    <li> Organic ✔</li>
                    <li>Grass-fed, pasture-raised meat and dairy ✔</li>
                    <li>Gluten-free ✔</li>
                  </ul>

              <p className='about-description '>
                Every meal we create is crafted to support your health, respect the planet, and celebrate the pure flavors of real food. We believe that eating well is not just a trend—it's a lifestyle rooted in care, quality, and conscious choices.
              </p>

              <p className='about-description '>
                At the heart of Earth Table is Chef Selena Campoli, the creative force behind our vibrant, holistic cuisine. 
                <br />
                With a passion for crafting meals that nurture both body and soul, she blends culinary artistry with a deep commitment to wellness.
              </p>

              <p className='about-description '>

                Drawing on years of experience in high-end kitchens and personal chef services, Selena's food is all about clean ingredients, bold flavors, and luxurious simplicity. Whether she's designing a personalized meal plan or preparing an elegant dinner, she believes that eating well should feel joyful and effortless.
              </p>

                <div className='signature-container'>
                  <img
                  src={signature1}
                  className='signature-one'
                  />
                  <img 
                  src={signature2}
                  className='signature-two'
                  />
                </div>
              </div>

              <div className="owner-image">
                <img src={ownerPicture} alt="Owner" />
              </div>
            </div>

          </div>
        </div>

        
      </div>

      </div>
      
      <div className='sub-footer'>
        <p className='sub-footer-quote'>Nourishing your body and soul</p>
      </div>

    </div>
    
  )
};

export default About;
