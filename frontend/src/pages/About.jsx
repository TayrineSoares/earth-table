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
            <br/> 
            
            <div className="about-description-row">
              <div className="about-description-container">
                <p className="about-description">
                  At Earth Table, we believe in nourishing people with wholesome, delicious food. 
                  Our holistic meal prep and personal chef services are designed for your well-being and peace of mind.
                </p>

                <p className="about-description">
                  We use only the finest ingredients:
                </p>
                <ul className="about-description" style={{ listStyleType: "none", paddingLeft: 0 }}>
                  <li>Seed oil free ✔</li>
                  <li>Organic ✔</li>
                  <li>Grass-fed, pasture-raised meat & dairy ✔</li>
                  <li>Gluten-free ✔</li>
                </ul>

                <br/> 

                <p className="about-description">
                  At the heart of Earth Table is Chef Selena Campoli, blending culinary artistry with a passion for wellness.
                </p>

                <p className="about-description">
                  With years of high-end kitchen and personal chef experience, Selena crafts clean, flavorful dishes 
                  that make eating well feel joyful and effortless.
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
