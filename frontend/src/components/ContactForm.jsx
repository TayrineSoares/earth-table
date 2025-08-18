import { useState } from 'react';
import "../styles/ContactForm.css"

const ContactForm = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [status, setStatus] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Sending...');

    try {
      const res = await fetch('http://localhost:8080/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('Message sent!');
        setForm({ name: '', email: '', message: '' });
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus('Something went wrong.');
    }
  };

  return (
    <div className="contact-form">
      <form onSubmit={handleSubmit}>
        <div className='your-name-container'>
          <p className='your-name-header'>Your Name</p>
          <input
            className='your-name-input'
            type="text"
            name="name"
            placeholder="FULL NAME"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>
        <br />
        <div className='your-name-container'>
          <p className='your-name-header'>Email</p>
          <input
            className='your-name-input'
            type="email"
            name="email"
            placeholder="NAME@EXAMPLE.COM"
            value={form.email}
            onChange={handleChange}
            required
            />
        </div>
        <br />
        <div className='your-message-container'>
          <p className='your-name-header'>Message</p>
          <input
            className='your-message-input'
            name="message"
            placeholder="TYPE YOUR MESSAGE HERE"
            value={form.message}
            onChange={handleChange}
            required
            />
        </div>
        <br />
          <button
            className='contact-submit-button'
            type="submit"
          >Send Message</button>
      </form>
      {status && (
        <p className="contact-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
};

export default ContactForm;
