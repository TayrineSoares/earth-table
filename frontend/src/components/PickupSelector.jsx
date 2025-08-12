import { useState } from "react";

const PickupSelector = () => {
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");

  // calculate minimum available date (today + 3 days)
  const getMinDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toISOString().split("T")[0]; // format: YYYY-MM-DD  

  }

  const handleDateChange = (e) => {
    const selectedDate = e.target.value; 
    if (!selectedDate) return;

    // Parse into local time
    const [year, month, day] = selectedDate.split("-");
    const localDate = new Date(year, month - 1, day);

    const dayOfWeek = localDate.getDay();

    if (dayOfWeek === 2) {   // 2 = tuesday
      alert("Sorry, pickups are not available on Tuesdays. Please choose another day.");
      return;
    }
    setPickupDate(selectedDate);
  }

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
          onChange={(e) => setPickupTime(e.target.value)}
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
