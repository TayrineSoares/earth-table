import '../styles/PickupSelector.css'

const PickupSelector = ({ 
  pickupDate, 
  pickupTime, 
  onDateChange, 
  onTimeChange }) => {

  
  // helper: Date -> "YYYY-MM-DD" in LOCAL time
  const formatAsInputDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  
  const getMinDate = () => {
    const today = new Date();
    const min = new Date(today);
    min.setDate(min.getDate() + 3);
    return formatAsInputDate(min);
  };

  const handleDateChange = (e) => {
    const selectedDate = e.target.value; 
    if (!selectedDate) return;

    // Enforce 72h even if value was typed manually
    if (selectedDate < getMinDate()) {
      alert(`Earliest pickup is ${getMinDate()}. Please choose a later date.`);
      return;
    }

    // Parse into local time
    const [year, month, day] = selectedDate.split("-");
    const localDate = new Date(year, month - 1, day);

    const dayOfWeek = localDate.getDay();

    if (dayOfWeek === 2) {   // 2 = tuesday
      alert("Sorry, pickups are not available on Tuesdays. Please choose another day.");
      return;
    }
    onDateChange(selectedDate);
    onTimeChange("");
    
  }

  const handleTimeChange = (e) => {
    onTimeChange(e.target.value)
  };


  // Format date for display
  const formatDisplayDate = (dateString) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "long",   // Tuesday
      month: "long",     // August
      day: "numeric",    // 15
      year: "numeric"    // 2025
    });
  };


  return (
    <section className="pickup-section">

      <div className="pickup-grid">
        {/* Date */}
        <div className="pickup-field">
          <label className="pickup-label" htmlFor="pickup-date">Pickup Date</label>
          <input
            id="pickup-date"
            className="pickup-input"
            type="date"
            value={pickupDate}
            min={getMinDate()}
            onChange={handleDateChange}
          />
          <p className="pickup-hint">Earliest available date is in 72 hours. (No Tuesdays)</p>
        </div>

        {/* Time */}
        <div className="pickup-field">
          <label className="pickup-label" htmlFor="pickup-time">Pickup Time</label>
          <select
            id="pickup-time"
            className="pickup-select"
            value={pickupTime}
            onChange={handleTimeChange}
            disabled={!pickupDate}
          >
            <option value="">Select a time slot</option>
            <option value="9:00-12:00">9:00 - 12:00</option>
            <option value="13:00-16:00">13:00 - 16:00</option>
          </select>
        </div>
      </div>

      <div className="pickup-notes">
        <p>Please review your order details and pickup time before continuing.</p>
        <p>Once payment is processed, orders cannot be modified or cancelled.</p>
      </div>
     
    </section>
  )
};

export default PickupSelector;
