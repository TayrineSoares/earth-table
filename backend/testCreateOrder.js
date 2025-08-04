const { createOrderWithProducts } = require('./src/queries/order');
const supabase = require('./supabase/db');

(async () => {
  try {
    const fakeOrder = {
      buyer_last_name: 'Doe',
      buyer_phone_number: '123-456-7890',
      buyer_address: '123 Fake Street, Toronto, ON',
      buyer_stripe_payment_info: JSON.stringify({ payment_intent: 'pi_test_1234' }),
      status: 'pending',
      products: [
        {
          id: 1,               // make sure this product ID exists in your DB
          quantity: 2,
          price_cents: 1200
        },
        {
          id: 2,               // another valid product ID
          quantity: 1,
          price_cents: 1600
        }
      ]
    };

    const order = await createOrderWithProducts(fakeOrder);
    console.log("✅ Order created successfully:", order);
  } catch (error) {
    console.error("❌ Error creating order:", error.message);
  }
})();
