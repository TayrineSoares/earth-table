const supabase = require('../supabase/db');

async function seed() {
  try {
    console.log('Starting seed...');

    // Clear existing data
    await supabase.from('order_products').delete().neq('id', 0);
    await supabase.from('orders').delete().neq('id', 0);
    await supabase.from('products').delete().neq('id', 0);
    await supabase.from('categories').delete().neq('id', 0);
    await supabase.from('user').delete().neq('id', 0);

    await supabase.rpc('reset_id_sequences');

    // Categories
    const { data: categories, error: catErr } = await supabase
      .from('categories')
      .insert([
        { name: 'Bowls' },
        { name: 'Cleansing' },
        { name: 'Catering' },
        { name: 'Personalized Meals' }
      ])
      .select();

    if (catErr) throw catErr;

    // Products
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .insert([
        {
          slug: 'nourish-bowl',
          image_url: 'https://example.com/nourish.jpg',
          description: 'Nourish Bowl with quinoa, sweet potato, kale, tahini dressing.',
          price_cents: 1499,
          category_id: categories.find(c => c.name === 'Bowls').id,
          is_available: true
        },
        {
          slug: 'green-goddess-bowl',
          image_url: 'https://example.com/green-goddess.jpg',
          description: 'Green Goddess Bowl with avocado, greens, and herbed dressing.',
          price_cents: 1599,
          category_id: categories.find(c => c.name === 'Bowls').id,
          is_available: true
        },
        {
          slug: 'protein-power-bowl',
          image_url: 'https://example.com/protein-power.jpg',
          description: 'Protein Power Bowl with lentils, tofu, and edamame.',
          price_cents: 1699,
          category_id: categories.find(c => c.name === 'Bowls').id,
          is_available: true
        },
        {
          slug: 'reset-juice-pack',
          image_url: 'https://example.com/reset.jpg',
          description: 'Reset Juice Pack of 3 cold-pressed juices.',
          price_cents: 2200,
          category_id: categories.find(c => c.name === 'Cleansing').id,
          is_available: true
        },
        {
          slug: 'vegan-feast',
          image_url: 'https://example.com/feast.jpg',
          description: 'Family Style Vegan Feast for 4-6 people.',
          price_cents: 8500,
          category_id: categories.find(c => c.name === 'Catering').id,
          is_available: true
        },
        {
          slug: 'custom-meal-plan',
          image_url: 'https://example.com/custom.jpg',
          description: 'Custom Meal Plan tailored to your health goals.',
          price_cents: 12000,
          category_id: categories.find(c => c.name === 'Personalized Meals').id,
          is_available: true
        }
      ])
      .select();

    if (prodErr) throw prodErr;

    // Users
    const { data: users, error: userErr } = await supabase
      .from('users')
      .insert([
        {
          first_name: 'Selena',
          last_name: 'Founder',
          email: 'selena@earthtable.com',
          country: 'Canada',
          password_hash: 'hashed_pw',
          phone_number: '1112223333',
          is_admin: true
        },
        {
          first_name: 'Jane',
          last_name: 'Wellness',
          email: 'jane@example.com',
          country: 'Canada',
          password_hash: 'hashed_pw',
          phone_number: '4445556666',
          is_admin: false
        },
        {
          first_name: 'Mike',
          last_name: 'Greens',
          email: 'mike@example.com',
          country: 'Canada',
          password_hash: 'hashed_pw',
          phone_number: '7778889999',
          is_admin: false
        }
      ])
      .select();

    if (userErr) throw userErr;

    const { data: orders, error: orderErr } = await supabase
  .from('orders')
  .insert([
    {
      user_id: users[1].id,
      total_cents: 5198,
      buyer_first_name: 'Jane',
      buyer_last_name: 'Wellness',
      buyer_phone_number: '4445556666',
      buyer_address: '123 Health St.',
      buyer_stripe_payment_info: 'stripe_jane_001',
      status: 'completed'
    },
    {
      user_id: users[1].id,
      total_cents: 8999,
      buyer_first_name: 'Jane',
      buyer_last_name: 'Wellness',
      buyer_phone_number: '4445556666',
      buyer_address: '123 Health St.',
      buyer_stripe_payment_info: 'stripe_jane_002',
      status: 'pending'
    },
    {
      user_id: users[1].id,
      total_cents: 4500,
      buyer_first_name: 'Jane',
      buyer_last_name: 'Wellness',
      buyer_phone_number: '4445556666',
      buyer_address: '123 Health St.',
      buyer_stripe_payment_info: 'stripe_jane_003',
      status: 'cancelled'
    },
    {
      user_id: users[2].id,
      total_cents: 12000,
      buyer_first_name: 'Mike',
      buyer_last_name: 'Greens',
      buyer_phone_number: '7778889999',
      buyer_address: '456 Wellness Rd.',
      buyer_stripe_payment_info: 'stripe_mike_002',
      status: 'pending'
    }
  ])
  .select();

    if (orderErr) throw orderErr;

    // Order_products
    const { error: opErr } = await supabase
      .from('order_products')
      .insert([
        {
          order_id: orders[0].id,
          product_id: products.find(p => p.slug === 'nourish-bowl').id,
          quantity: 2,
          unit_price_cents: 1499
        },
        {
          order_id: orders[0].id,
          product_id: products.find(p => p.slug === 'reset-juice-pack').id,
          quantity: 1,
          unit_price_cents: 2200
        },
        {
          order_id: orders[1].id,
          product_id: products.find(p => p.slug === 'custom-meal-plan').id,
          quantity: 1,
          unit_price_cents: 12000
        }
      ]);

    if (opErr) throw opErr;

    console.log('Seed complete!');
  } catch (err) {
    console.error('Seed failed:', err.message);
  }
}

seed();
