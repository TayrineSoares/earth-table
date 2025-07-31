import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserByAuthId } from '../helpers/adminHelpers';
import { supabase } from '../supabaseClient';
import '../styles/Admin.css'
import CategoryAdmin from '../components/CategoryAdmin';
import OrderAdmin from '../components/OrderAdmin';
import ProductAdmin from '../components/ProductAdmin';
import UserAdmin from '../components/UserAdmin'; 



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
     <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Board</h1>
        <p>Welcome, {user.first_name || user.email}!</p>
      </div>

      <div className="admin-tabs">
        <button 
          className={activeTab === 'categories' ? 'active' : ''}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
        <button 
          className={activeTab === 'products' ? 'active' : ''}
          onClick={() => setActiveTab('products')}
        >
          Products
        </button>
        <button 
          className={activeTab === 'orders' ? 'active' : ''}
          onClick={() => setActiveTab('orders')}
        >
          Orders
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
      </div>

      {/* Active tab section */}
      {activeTab === 'categories' && <CategoryAdmin />}
      {activeTab === 'products' && <ProductAdmin />}
      {activeTab === 'orders' && <OrderAdmin />}
      {activeTab === 'users' && <UserAdmin />}
    </div>
  );
};

export default Admin;