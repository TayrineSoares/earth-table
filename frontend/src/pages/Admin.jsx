import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserByAuthId } from '../helpers/adminHelpers';
import CategoryAdmin from '../components/CategoryAdmin';
import OrderAdmin from '../components/OrderAdmin';
import ProductAdmin from '../components/ProductAdmin';
import UserAdmin from '../components/UserAdmin'; 
import { supabase } from '../supabaseClient';

const Admin = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        navigate('/');
        return;
      }


      try {
        const userInfo = await fetchUserByAuthId(session.user.id);

        if (!userInfo.is_admin) {
          navigate('/');
        } else {
          setUser(userInfo);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        navigate('/');
      }
    };

    fetchUser();

  }, [navigate]);

  if (!user) return null;


  return (
    <div>

      <h1>Admin Page!</h1>
      <p>Welcome, {user.first_name || user.email}</p>
      <br />
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <button onClick={() => setActiveTab('categories')}>Categories</button>
        <button onClick={() => setActiveTab('products')}>Products</button>
        <button onClick={() => setActiveTab('orders')}>Orders</button>
        <button onClick={() => setActiveTab('users')}>Users</button>
      </div>

      {activeTab === 'categories' && <CategoryAdmin />}
      {activeTab === 'products' && <ProductAdmin />}
      {activeTab === 'orders' && <OrderAdmin />}
      {activeTab === 'users' && <UserAdmin />}
      
    
    </div>
  )
};

export default Admin;