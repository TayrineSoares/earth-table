import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import {
  DELIVERY_WINDOW,
  fetchOrdersByAuthId,
  formatMoney,
  formatOrderPlacedDate,
  formatTimeWindow,
  formatYmdLong,
  formatYmdMedium,
  getFulfillmentYmd,
  getItemCount,
  getOrderTotals,
  getPostalFromBuyerInfo,
  isOrderCompleted,
  isOrderItemAvailable,
  PICKUP_ADDRESS,
  shortOrderId,
  toCartProduct,
} from "../helpers/orderHelpers";
import { supabase } from "../supabaseClient";
import FeedbackDialog from "../components/FeedbackDialog";
import "../styles/Cart.css";
import "../styles/OrderHistory.css";
import loadingAnimation from "../assets/loading.json";
import Lottie from "lottie-react";
import checkoutImage from "../assets/images/checkoutImage.png";

const ITEM_PREVIEW = 4;
const FILTERS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
];

const itemsOf = (order) =>
  Array.isArray(order?.order_products) ? order.order_products : [];

const itemLabel = (count) => `${count} ${count === 1 ? "item" : "items"}`;

const fulfillmentWindow = (order) => {
  if (order.delivery) return formatTimeWindow(DELIVERY_WINDOW) || DELIVERY_WINDOW;
  return formatTimeWindow(order.pickup_time_slot) || "—";
};

const collapsedSummary = (order, completed) => {
  const date = formatYmdMedium(getFulfillmentYmd(order)) || "—";
  const verb = order.delivery
    ? (completed ? "Delivered" : "Delivery")
    : (completed ? "Picked up" : "Pickup");
  return `${verb} ${date} · ${itemLabel(getItemCount(order))}`;
};

const OrderItemRow = ({ item, onReorder }) => {
  const available = isOrderItemAvailable(item);
  const name = item.product?.slug || "Unnamed product";
  const productId = item.product?.id || item.product_id;
  const qty = Number(item.quantity) || 0;
  const unitCents = Number(item.unit_price_cents) || 0;
  const lineTotal = qty * unitCents;

  const body = (
    <>
      {item.product?.image_url ? (
        <img src={item.product.image_url} alt="" className="order-item-image" />
      ) : (
        <div className="order-item-image order-item-image--placeholder" />
      )}
      <div className="order-item-details">
        <p className="order-item-name">{name}</p>
        <p className="order-item-unit">
          {qty} × {formatMoney(unitCents)}
        </p>
      </div>
      <p className="order-item-line-total">{formatMoney(lineTotal)}</p>
    </>
  );

  return (
    <li className={`order-item${available ? "" : " is-unavailable"}`}>
      {available && productId ? (
        <Link to={`/products/${productId}`} className="order-item-link">
          {body}
        </Link>
      ) : (
        <div className="order-item-link">{body}</div>
      )}
      {available ? (
        <button
          type="button"
          className="order-history-button order-history-button--small"
          onClick={() => onReorder(item)}
        >
          Reorder
        </button>
      ) : (
        <span className="order-item-unavailable">Unavailable</span>
      )}
    </li>
  );
};

const ExpandedOrderCard = ({
  order,
  canCollapse,
  isCurrent,
  printTarget,
  onReorderAll,
  onReorderItem,
  onToggleDetails,
  onPrintReceipt,
}) => {
  const [showAllItems, setShowAllItems] = useState(false);
  const isDelivery = Boolean(order.delivery);
  const items = itemsOf(order);
  const hiddenCount = Math.max(0, items.length - ITEM_PREVIEW);
  const visibleItems = printTarget || showAllItems || hiddenCount === 0
    ? items
    : items.slice(0, ITEM_PREVIEW);
  const totals = getOrderTotals(order);
  const postal = isDelivery ? getPostalFromBuyerInfo(order.buyer_stripe_payment_info) : "";
  const dateLabel = formatYmdLong(getFulfillmentYmd(order)) || "—";
  const windowLabel = fulfillmentWindow(order);
  const address = isDelivery ? (postal || "") : PICKUP_ADDRESS;
  const note = String(order.special_note || "").trim();

  return (
    <article
      className={`order-card order-card--expanded${isCurrent ? " is-current" : ""}${printTarget ? " is-print-target" : ""}`}
    >
      <header className="order-card-header">
        <div className="order-card-header-main">
          <p className="order-card-id">Order {shortOrderId(order.id)}</p>
        </div>
        <p className="order-card-placed">
          {formatOrderPlacedDate(order.created_at)
            ? `Placed ${formatOrderPlacedDate(order.created_at)}`
            : ""}
        </p>
      </header>

      <div className="order-card-body">
        <div className="order-items-col">
          {items.length > 0 && (
            <ul className="order-items">
              {visibleItems.map((item, idx) => (
                <OrderItemRow
                  key={`${item.product?.id || item.product_id || item.product?.slug || "item"}-${idx}`}
                  item={item}
                  onReorder={onReorderItem}
                />
              ))}
            </ul>
          )}
          {hiddenCount > 0 && !showAllItems && !printTarget && (
            <button
              type="button"
              className="order-text-link order-show-more"
              onClick={() => setShowAllItems(true)}
            >
              Show {hiddenCount} more {hiddenCount === 1 ? "item" : "items"}
            </button>
          )}
        </div>

        <aside className="order-summary-col">
          <div className="order-fulfillment">
            <p className="order-fulfillment-label">{isDelivery ? "Delivery" : "Pickup"}</p>
            <p className="order-fulfillment-when">
              {dateLabel} · {windowLabel}
            </p>
            {!!address && <p className="order-fulfillment-address">{address}</p>}
            {!!note && (
              <p className="order-fulfillment-note">{note}</p>
            )}
          </div>

          <div className="order-totals">
            {totals.itemSubtotalCents > 0 && (
              <div className="order-total-row">
                <span>Subtotal</span>
                <span>{formatMoney(totals.itemSubtotalCents)}</span>
              </div>
            )}
            {totals.discount && (
              <div className="order-total-row">
                <span>
                  {totals.discount.label} ({totals.discount.code})
                  {totals.discount.percent != null ? ` — ${totals.discount.percent}% off` : ""}
                </span>
                <span>−{formatMoney(totals.discountCents)}</span>
              </div>
            )}
            {totals.deliveryPreTaxCents > 0 && (
              <div className="order-total-row">
                <span>Delivery fee</span>
                <span>{formatMoney(totals.deliveryPreTaxCents)}</span>
              </div>
            )}
            {totals.hstCents > 0 && (
              <div className="order-total-row">
                <span>HST</span>
                <span>{formatMoney(totals.hstCents)}</span>
              </div>
            )}
            {totals.creditCents > 0 && (
              <div className="order-total-row">
                <span>Store credit</span>
                <span>−{formatMoney(totals.creditCents)}</span>
              </div>
            )}
            <div className="order-total-row order-total-row--grand">
              <span>Total</span>
              <span>{formatMoney(totals.totalCents)}</span>
            </div>
          </div>

          <button
            type="button"
            className="order-history-cta"
            onClick={() => onReorderAll(order)}
          >
            Reorder all
          </button>
          <button
            type="button"
            className="order-text-link order-receipt-link"
            onClick={() => onPrintReceipt(order.id)}
          >
            Print receipt
          </button>
          {canCollapse && (
            <button
              type="button"
              className="order-text-link"
              onClick={onToggleDetails}
            >
              Hide details
            </button>
          )}
        </aside>
      </div>
    </article>
  );
};

const CollapsedOrderRow = ({ order, completed, onReorderAll, onToggleDetails }) => {
  const totals = getOrderTotals(order);

  return (
    <article className="order-card order-card--collapsed">
      <div className="order-row-left">
        <div className="order-row-title">
          <p className="order-row-id">Order {shortOrderId(order.id)}</p>
        </div>
        <p className="order-row-meta">{collapsedSummary(order, completed)}</p>
      </div>
      <div className="order-row-right">
        <p className="order-row-total">{formatMoney(totals.totalCents)}</p>
        <button
          type="button"
          className="order-text-link"
          onClick={() => onReorderAll(order)}
        >
          Reorder
        </button>
        <button
          type="button"
          className="order-text-link"
          aria-expanded="false"
          onClick={onToggleDetails}
        >
          Details
        </button>
      </div>
    </article>
  );
};

const OrderHistory = ({ user, addToCart }) => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(Boolean(user?.id));
  const [filter, setFilter] = useState("all");
  const [detailsOpen, setDetailsOpen] = useState({});
  const [printId, setPrintId] = useState(null);
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadOrders = async () => {
      const sessionUserId =
        user?.id ||
        (await supabase.auth.getSession()).data.session?.user?.id ||
        null;

      if (!sessionUserId) {
        if (!cancelled) {
          setSignedIn(false);
          setOrders([]);
          setIsLoading(false);
        }
        return;
      }

      try {
        const data = await fetchOrdersByAuthId(sessionUserId);
        if (!cancelled) {
          setSignedIn(true);
          setOrders(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("Failed to load orders:", e);
        if (!cancelled) {
          setSignedIn(true);
          setOrders([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadOrders();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const featuredUpcomingId = useMemo(
    () => orders.find((order) => !isOrderCompleted(order))?.id || null,
    [orders]
  );

  const visibleOrders = useMemo(() => {
    if (filter === "upcoming") return orders.filter((order) => !isOrderCompleted(order));
    if (filter === "past") return orders.filter((order) => isOrderCompleted(order));
    return orders;
  }, [orders, filter]);

  const isExpanded = (order) => {
    if (Object.prototype.hasOwnProperty.call(detailsOpen, order.id)) {
      return Boolean(detailsOpen[order.id]);
    }
    return order.id === featuredUpcomingId;
  };

  const toggleDetails = (orderId, next) => {
    setDetailsOpen((prev) => ({ ...prev, [orderId]: next }));
  };

  const handleReorderItem = (item) => {
    if (!isOrderItemAvailable(item)) return;
    addToCart?.(toCartProduct(item), item.quantity);
  };

  const handleReorderAll = (order) => {
    const available = itemsOf(order).filter(isOrderItemAvailable);
    if (!available.length) {
      setDialog({
        icon: "alert",
        title: "Nothing to reorder",
        body: "None of the items from this order are available right now.",
        primaryLabel: "Got it",
      });
      return;
    }
    available.forEach((item) => addToCart?.(toCartProduct(item), item.quantity));
  };

  const handlePrintReceipt = (orderId) => {
    flushSync(() => {
      setDetailsOpen((prev) => ({ ...prev, [orderId]: true }));
      setPrintId(orderId);
    });
    window.print();
    setPrintId(null);
  };

  if (isLoading) {
    return (
      <div
        className="loading-container"
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Lottie animationData={loadingAnimation} loop={true} />
      </div>
    );
  }

  const emptyCopy = !signedIn
    ? "Sign in to see your order history."
    : !orders.length
      ? "You haven't placed an order yet."
      : filter === "upcoming"
        ? "No upcoming orders."
        : filter === "past"
          ? "No past orders."
          : "You haven't placed an order yet.";

  const emptyCta = !signedIn
    ? { to: "/login?next=/orders", label: "Log in", outline: true }
    : { to: "/products/category", label: "Browse the menu", outline: false };

  const showFilters = signedIn && orders.length > 0;
  const showEmpty = !signedIn || !visibleOrders.length;

  return (
    <div className="order-history-page">
      <div className="checkout-page-header-image">
        <img src={checkoutImage} className="checkout-image" alt="" />
      </div>

      <div className="page-wrapper">
        <div className="order-history-header">
          <h1 className="order-history-title">Your orders</h1>
          {showFilters && (
            <div className="order-history-filters" role="tablist" aria-label="Filter orders">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  className={`order-history-filter${filter === item.id ? " is-active" : ""}`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {showEmpty ? (
          <div className="order-history-empty">
            <p className="order-history-empty-copy">{emptyCopy}</p>
            {(!signedIn || !orders.length) && (
              <Link
                to={emptyCta.to}
                className={emptyCta.outline ? "order-history-button" : "order-history-cta"}
              >
                {emptyCta.label}
              </Link>
            )}
          </div>
        ) : (
          <div className="order-history-list">
            {visibleOrders.map((order) => {
              const completed = isOrderCompleted(order);
              const expanded = isExpanded(order);
              if (expanded) {
                return (
                  <ExpandedOrderCard
                    key={order.id}
                    order={order}
                    canCollapse={order.id !== featuredUpcomingId}
                    isCurrent={order.id === featuredUpcomingId}
                    printTarget={printId === order.id}
                    onReorderAll={handleReorderAll}
                    onReorderItem={handleReorderItem}
                    onToggleDetails={() => toggleDetails(order.id, false)}
                    onPrintReceipt={handlePrintReceipt}
                  />
                );
              }
              return (
                <CollapsedOrderRow
                  key={order.id}
                  order={order}
                  completed={completed}
                  onReorderAll={handleReorderAll}
                  onToggleDetails={() => toggleDetails(order.id, true)}
                />
              );
            })}
          </div>
        )}
      </div>

      <FeedbackDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
};

export default OrderHistory;
