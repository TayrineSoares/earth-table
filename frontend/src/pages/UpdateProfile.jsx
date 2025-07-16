import { useLocation } from 'react-router-dom';

const UpdateProfile = () => {

  // We use useLocation to access data passed via navigate()
  // from the previous page (Register). This allows us to retrieve
  // the newly created user object without relying on URL params.
  // NOTE: if the page is refreshed, location.state may be undefined.
  const location = useLocation();
  const user = location.state?.user;
  console.log(user);

  
  return (
    <div>

      <h1>Profile Page!</h1>
      <form>

        <input 
        type=""
        placeholder=""
        value={""}
        onChange={() => {}}
        required

        />
      </form>
      
    </div>
  )
};

export default UpdateProfile;