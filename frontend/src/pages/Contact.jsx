import ContactForm from "../components/ContactForm";
import contactHeaderImage from "../assets/images/contactHeader.png"
import "../styles/Contact.css"

const Contact = () => {
  return (
    <div className="contact-page">
      <div className="contact-header-image-container">
        <img src={contactHeaderImage} className="contact-header-image" alt="Background" />
      </div>

      <div className="page-wrapper">
        <div className="contact-header-text">
          <p className="contact-text">Contact</p>
          <p className="have-question">Have any questions? I'm happy to chat!</p>
        </div>

        <ContactForm />
      </div>   
    </div>
  )
};

export default Contact;
