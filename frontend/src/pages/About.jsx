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
                Lorem ipsum dolor sit amet consectetur. Justo etiam sed proin tristique urna. Cum laoreet posuere faucibus mus turpis vitae. Convallis eros lectus praesent lacus. A tellus nisl egestas aliquet condimentum. Sem vulputate tortor duis semper scelerisque commodo nisl.
              </p>

              <p className='about-description '>
                Bibendum placerat odio adipiscing non eget mi mauris. Eget elementum molestie cursus enim. Habitant ac nibh amet et. Vulputate id varius volutpat urna. Tortor nunc consequat scelerisque eu egestas. Fermentum commodo at auctor vitae risus amet. Eget amet vel at lacinia viverra sed. Urna duis sagittis ut pellentesque iaculis. Vitae viverra massa morbi arcu diam suspendisse faucibus. Consectetur et commodo leo arcu pellentesque. Est aliquet non nullam odio id rhoncus. Ipsum fusce euismod nisl lobortis massa.
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
        <p className='sub-footer-quote'>Quote, mission statement, etc</p>
      </div>

    </div>
    
  )
};

export default About;
