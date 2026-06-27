import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

Deno.serve(async (req) => {
  try {
    // Initialize Supabase client with Service Role Key (securely stored in Env Vars)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Delete orders older than 6 months
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    
    // First, get the IDs of old orders to delete
    const { data: oldOrderIds, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .lt('created_at', sixMonthsAgo);

    if (fetchError) throw fetchError;

    if (oldOrderIds && oldOrderIds.length > 0) {
      // Delete related order_items first to avoid foreign key constraint issues
      const orderIds = oldOrderIds.map(order => order.id);
      const { error: orderItemsError } = await supabase
        .from('order_items')
        .delete()
        .in('order_id', orderIds);

      if (orderItemsError) throw orderItemsError;

      // Then delete the old orders
      const { error, count } = await supabase
        .from('orders')
        .delete({ count: 'exact' })
        .in('id', orderIds);

      if (error) throw error;

      return new Response(JSON.stringify({ message: `Cleaned up ${count} orders and their related items.` }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ message: 'No old orders to clean up.' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }
  } catch (err) {
    console.error('Error in vacuum-orders function:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { 'Content-Type': 'application/json' },
      status: 500 
    })
  }
})