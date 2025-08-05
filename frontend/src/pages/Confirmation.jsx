import { Link } from 'react-router-dom';

const Confirmation = () => {
  return (
    <div>
      <h1>Thank You for Your Order!</h1>

      <p>Your payment was successful.</p>
      <p>A confirmation email has been sent to your inbox.</p>


      <Link to="/">Back to Home</Link>
    </div>
  );
};

export default Confirmation;