import { useEffect, useRef, useState } from "react";
import { sizedImageUrl } from "../helpers/imageHelpers";

const ProductCard = ({
  product,
  addToCart,
  tagIcons,
  getTagNames,
  eager = false,
  quantity,
  onIncrement,
  onDecrement,
  incrementDisabled = false,
}) => {
  const descriptionRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;

    const check = () => setIsOverflowing(el.scrollHeight > el.clientHeight);

    requestAnimationFrame(check);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [product.description]);

  // close on Esc
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => e.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const tagNames = product.tags?.length ? getTagNames(product.tags) : [];
  const cardImage = sizedImageUrl(product.image_url, 480);
  const cardImage2x = sizedImageUrl(product.image_url, 960);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  

  return (
    <div className="products">
      {tagNames.length > 0 && (
        <div className="product-tags">
          {tagNames.map((tagName) => (
            <div key={tagName} className="tag-icon">
              {tagIcons[tagName.toLowerCase()] || null}
              <span style={{ marginLeft: "4px" }}>{tagName}</span>
            </div>
          ))}
        </div>
      )}

      <img
        className="product-image"
        src={cardImage}
        srcSet={`${cardImage} 1x, ${cardImage2x} 2x`}
        alt={product.slug}
        loading={eager ? "eager" : "lazy"}
      />

      <div className="product-header-info-container">
        <p className="product-header-price">${(product.price_cents / 100).toFixed(2)}</p>
        <p className="product-header-name">{product.slug}</p>
      </div>

      <div className="product-description-container">
        <p ref={descriptionRef} className="product-description">
          {product.description}
        </p>
      </div>

      {isOverflowing && (
        <button
          className="view-details-inline"
          type="button"
          onClick={() => setIsOpen(true)}
        >
          View details
        </button>
      )}

      <div className="product-add-button-container">
        {onIncrement ? (
          product.is_available ? (
            <div className="product-qty-stepper">
              <button
                type="button"
                className="product-qty-btn"
                onClick={() => onDecrement(product)}
                disabled={!quantity}
                aria-label={`Decrease ${product.slug}`}
              >
                -
              </button>
              <span className="product-qty-value">{quantity || 0}</span>
              <button
                type="button"
                className="product-qty-btn"
                onClick={() => onIncrement(product)}
                disabled={incrementDisabled}
                aria-label={`Increase ${product.slug}`}
              >
                +
              </button>
            </div>
          ) : (
            <button className="product-add-button" type="button" disabled style={{ cursor: "not-allowed" }}>
              <p className="product-add-button-text">SOLD OUT!</p>
            </button>
          )
        ) : product.is_available ? (
          <button className="product-add-button" onClick={() => addToCart(product)}>
            <p className="product-add-button-text">ADD TO CART</p>
          </button>
        ) : (
          <button className="product-add-button" disabled style={{ cursor: "not-allowed" }}>
            <p className="product-add-button-text">SOLD OUT!</p>
          </button>
        )}
      </div>

      {/* Modal */}
      {isOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Details for ${product.slug}`}
          onClick={() => setIsOpen(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>

            <img className="modal-image" src={product.image_url} alt={product.slug} />

            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">{product.slug}</h3>
                <p className="modal-price">${(product.price_cents / 100).toFixed(2)}</p>
              </div>

              {tagNames.length > 0 && (
                <div className="modal-tags">
                  {tagNames.map((tagName) => (
                    <span key={tagName} className="modal-tag">
                      {tagName}
                    </span>
                  ))}
                </div>
              )}

              <p className="modal-description">{product.description}</p>

              <div className="modal-actions">
                {onIncrement ? (
                  product.is_available ? (
                    <div className="product-qty-stepper">
                      <button
                        type="button"
                        className="product-qty-btn"
                        onClick={() => onDecrement(product)}
                        disabled={!quantity}
                        aria-label={`Decrease ${product.slug}`}
                      >
                        -
                      </button>
                      <span className="product-qty-value">{quantity || 0}</span>
                      <button
                        type="button"
                        className="product-qty-btn"
                        onClick={() => onIncrement(product)}
                        disabled={incrementDisabled}
                        aria-label={`Increase ${product.slug}`}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button className="product-add-button" type="button" disabled>
                      <p className="product-add-button-text">SOLD OUT!</p>
                    </button>
                  )
                ) : product.is_available ? (
                  <button
                    className="product-add-button"
                    type="button"
                    onClick={() => {
                      addToCart(product);
                      setIsOpen(false);
                    }}
                  >
                    <p className="product-add-button-text">ADD TO CART</p>
                  </button>
                ) : (
                  <button className="product-add-button" type="button" disabled>
                    <p className="product-add-button-text">SOLD OUT!</p>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCard;
