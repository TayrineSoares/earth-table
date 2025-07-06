import loadingAnimation from '../assets/loading.json'

const Cart = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8080/cart')
      .then(res => res.json())
      .then(data => {
        setAllProducts(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="loading-container">
        <Lottie animationData={loadingAnimation} loop={true} />
      </div>
    );
  }

  return (
    <div>

      
      <h1>Cart Page!</h1>
      
    </div>
  )
};

export default Cart;