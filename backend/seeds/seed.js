const supabase = require('../supabase/db');

async function seed() {
  try {
    console.log('Starting seed...');

    // Clear existing data
    await supabase.from('order_products').delete().neq('id', 0);
    await supabase.from('orders').delete().neq('id', 0);
    await supabase.from('products').delete().neq('id', 0);
    await supabase.from('categories').delete().neq('id', 0);
    await supabase.from('users').delete().neq('id', 0);

    await supabase.rpc('reset_id_sequences');

     // Categories
    const { data: categories, error: catErr } = await supabase
      .from('categories')
      .insert([
        { 
          name: 'Bowls',
          image_url: 'https://plus.unsplash.com/premium_photo-1705056547195-a68c45f2d77e?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8Zm9vZCUyMGJvd2x8ZW58MHx8MHx8fDA%3D',
          show_on_homepage: true
        },

        { 
          name: 'Cleansing',
          image_url: 'https://images.unsplash.com/photo-1613637069941-06b7dbc394a4?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZGV0b3h8ZW58MHx8MHx8fDA%3D',
          show_on_homepage: false

        },

        { 
          name: 'Catering',
          image_url: 'https://images.unsplash.com/photo-1518619745898-93e765966dcd?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Zm9vZCUyMGNhdGVyaW5nfGVufDB8fDB8fHww',
          show_on_homepage: true
            
        },

        { 
          name: 'Personalized Meals',
          image_url: 'https://images.unsplash.com/photo-1543352632-5a4b24e4d2a6?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8bWVhbCUyMHBsYW58ZW58MHx8MHx8fDA%3D',
          show_on_homepage: false
        
        }
      ])
      .select();

    if (catErr) throw catErr;

    // Products
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .insert([
        {
          slug: 'nourish-bowl',
          image_url: 'https://plus.unsplash.com/premium_photo-1661759410516-945250a82834?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8Ym93bHxlbnwwfHwwfHx8MA%3D%3D',
          description: 'Nourish Bowl with quinoa, sweet potato, kale, tahini dressing.',
          price_cents: 1499,
          category_id: categories.find(c => c.name === 'Bowls').id,
          is_available: true
        },
        {
          slug: 'green-goddess-bowl',
          image_url: 'https://images.unsplash.com/photo-1701109876066-7fc0c08da447?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8Z3JlZW4lMjBib3dsfGVufDB8fDB8fHww',
          description: 'Green Goddess Bowl with avocado, greens, and herbed dressing.',
          price_cents: 1599,
          category_id: categories.find(c => c.name === 'Bowls').id,
          is_available: true
        },
        {
          slug: 'protein-power-bowl',
          image_url: 'https://plus.unsplash.com/premium_photo-1673580742886-1129e6e1f829?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8cHJvdGVpbiUyMGJvd2x8ZW58MHx8MHx8fDA%3D',
          description: 'Protein Power Bowl with lentils, tofu, and edamame.',
          price_cents: 1699,
          category_id: categories.find(c => c.name === 'Bowls').id,
          is_available: true
        },
        {
          slug: 'reset-juice-pack',
          image_url: 'https://plus.unsplash.com/premium_photo-1663126827264-409d695e0be7?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8anVpY2V8ZW58MHx8MHx8fDA%3D',
          description: 'Reset Juice Pack of 3 cold-pressed juices.',
          price_cents: 2200,
          category_id: categories.find(c => c.name === 'Cleansing').id,
          is_available: true
        },
        {
          slug: 'vegan-feast',
          image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8dmVnYW58ZW58MHx8MHx8fDA%3D',
          description: 'Family Style Vegan Feast for 4-6 people.',
          price_cents: 8500,
          category_id: categories.find(c => c.name === 'Catering').id,
          is_available: true
        },
        {
          slug: 'custom-meal-plan',
          image_url: 'https://plus.unsplash.com/premium_photo-1669056783712-a3b0b8505f71?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8bWVhbCUyMHBsYW58ZW58MHx8MHx8fDA%3D',
          description: 'Custom Meal Plan tailored to your health goals.',
          price_cents: 12000,
          category_id: categories.find(c => c.name === 'Personalized Meals').id,
          is_available: true
        },
        {
          slug: 'nourish-bowl',
          image_url: 'https://plus.unsplash.com/premium_photo-1661759410516-945250a82834?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8Ym93bHxlbnwwfHwwfHx8MA%3D%3D',
          description: 'Nourish Bowl with quinoa, sweet potato, kale, tahini dressing.',
          price_cents: 1499,
          category_id: categories.find(c => c.name === 'Bowls').id,
          is_available: true
        },
        {
          slug: 'green-goddess-bowl',
          image_url: 'https://images.unsplash.com/photo-1701109876066-7fc0c08da447?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8Z3JlZW4lMjBib3dsfGVufDB8fDB8fHww',
          description: 'Green Goddess Bowl with avocado, greens, and herbed dressing.',
          price_cents: 1599,
          category_id: categories.find(c => c.name === 'Bowls').id,
          is_available: true
        },
        {
          slug: 'protein-power-bowl',
          image_url: 'https://plus.unsplash.com/premium_photo-1673580742886-1129e6e1f829?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8cHJvdGVpbiUyMGJvd2x8ZW58MHx8MHx8fDA%3D',
          description: 'Protein Power Bowl with lentils, tofu, and edamame.',
          price_cents: 1699,
          category_id: categories.find(c => c.name === 'Bowls').id,
          is_available: true
        },
        {
          slug: 'reset-juice-pack',
          image_url: 'https://plus.unsplash.com/premium_photo-1663126827264-409d695e0be7?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8anVpY2V8ZW58MHx8MHx8fDA%3D',
          description: 'Reset Juice Pack of 3 cold-pressed juices.',
          price_cents: 2200,
          category_id: categories.find(c => c.name === 'Cleansing').id,
          is_available: true
        },
        {
          slug: 'vegan-feast',
          image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8dmVnYW58ZW58MHx8MHx8fDA%3D',
          description: 'Family Style Vegan Feast for 4-6 people.',
          price_cents: 8500,
          category_id: categories.find(c => c.name === 'Catering').id,
          is_available: true
        },
        {
          slug: 'custom-meal-plan',
          image_url: 'https://plus.unsplash.com/premium_photo-1669056783712-a3b0b8505f71?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8bWVhbCUyMHBsYW58ZW58MHx8MHx8fDA%3D',
          description: 'Custom Meal Plan tailored to your health goals.',
          price_cents: 12000,
          category_id: categories.find(c => c.name === 'Personalized Meals').id,
          is_available: true
        },
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
