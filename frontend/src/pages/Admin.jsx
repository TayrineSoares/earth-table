import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchUserByAuthId } from '../helpers/adminHelpers';
import { supabase } from '../supabaseClient';
import '../styles/Admin.css'
import CategoryAdmin from '../components/CategoryAdmin';
import OrderAdmin from '../components/OrderAdmin';
import ProductAdmin from '../components/ProductAdmin';
import UserAdmin from '../components/UserAdmin';
import PromoAdmin from '../components/PromoAdmin';
import PartnerAdmin from '../components/PartnerAdmin';
import SubscriptionAdmin from '../components/SubscriptionAdmin';
import SubscriberAdmin from '../components/SubscriberAdmin';


const Admin = () => {
  const [user, setUser] = useState(null);
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || null);
  const navigate = useNavigate();

  useEffect(() => {
    if (tabFromUrl) setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

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
          className={activeTab === 'weekly-plans' ? 'active' : ''}
          onClick={() => setActiveTab('weekly-plans')}
        >
          Weekly Plans
        </button>
        <button 
          className={activeTab === 'products' ? 'active' : ''}
          onClick={() => setActiveTab('products')}
        >
          Menu
        </button>
        <button 
          className={activeTab === 'orders' ? 'active' : ''}
          onClick={() => setActiveTab('orders')}
        >
          Orders
        </button>
        <button 
          className={activeTab === 'subscriptions' ? 'active' : ''}
          onClick={() => setActiveTab('subscriptions')}
        >
          Subscriptions
        </button>
        <button 
          className={activeTab === 'promos' ? 'active' : ''}
          onClick={() => setActiveTab('promos')}
        >
          Promo Codes
        </button>
        <button 
          className={activeTab === 'partners' ? 'active' : ''}
          onClick={() => setActiveTab('partners')}
        >
          Partners
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
      {activeTab === 'weekly-plans' && <SubscriptionAdmin />}
      {activeTab === 'products' && <ProductAdmin />}
      {activeTab === 'orders' && <OrderAdmin />}
      {activeTab === 'subscriptions' && <SubscriberAdmin />}
      {activeTab === 'promos' && <PromoAdmin />}
      {activeTab === 'partners' && <PartnerAdmin />}
      {activeTab === 'users' && <UserAdmin currentUserId={user.auth_user_id} />}
    </div>
  );
};

export default Admin;