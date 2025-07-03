import '../styles/Home.css'
import bowlsImage from '../assets/images/bowls.jpg';
import cateringImage from '../assets/images/catering.jpg'


const Home = () => {
  return (
    <div className="homepage">
      <section className="heading">
        <h1>Earth Table</h1>
        <h3>Creating Nourishing Experiences that Support Your Health Journey.</h3>

      </section>

      {/* Zig-Zag Section 1 */}
      <section className="zigzag-section">
        <div className="zigzag-content">
          <div className="zigzag-text">
            <h2>BOWLS</h2>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. </p>
            <button>Shop Now</button>
          </div>
          <div className="zigzag-image">
            <img src={bowlsImage} alt="Section 1" />
          </div>
        </div>
      </section>

      {/* Zig-Zag Section 2 */}
      <section className="zigzag-section">
        <div className="zigzag-content reverse">
          <div className="zigzag-text">
            <h2>CATERING</h2>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. </p>
            <button>Shop Now</button>
          </div>
          <div className="zigzag-image">
            <img src={cateringImage} alt="Section 1" />
          </div>
        </div>
      </section>


  
      
      
    </div>
  )
};

export default Home;
