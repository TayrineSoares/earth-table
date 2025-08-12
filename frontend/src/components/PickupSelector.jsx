
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
    <div>
      <h3>Choose a pickup time slot </h3>
      {/* Date Picker */}
      <label>
        Pickup Date:
        <input
          type="date"
          value={pickupDate}
          min={getMinDate()}
          onChange={handleDateChange}
        />       
      </label>

      {/* Time Slot Selector */}
      <label style={{ marginLeft: "1rem" }}>
        Pickup Time:
        <select
          value={pickupTime}
          onChange={handleTimeChange}
          disabled={!pickupDate} //only allow if date is chosen
        >
          <option value=""> Select a time slot</option>
          <option value="9:00-12:00">9:00 - 12:00</option>
          <option value="13:00-16:00">13:00 - 16:00</option>

        </select>

      </label>

      {/* Debug Output */}
      <div style={{ marginTop: "1rem" }}>
        <strong>Pickup Summary</strong>{" "}
        <br/>
        {pickupDate ? formatDisplayDate(pickupDate) : "No date"}{" "}
        <br/>
        Time slot: {pickupTime || "No time slot selected"}
        <br/>
        Address: 123 Fake Street 
      </div>
      
    </div>
  )
};

export default PickupSelector;
