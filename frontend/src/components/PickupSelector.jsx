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




  return (
    <div>
      <h1>Pickup Selector component </h1>
      {/* Date Picker */}
      <lable>
        Pickup Date:
        <input
          type="date"
          value={pickupDate}
          min={getMinDate()}
          onChange={(e) => setPickupDate(e.target.value)}
        />       
      </lable>

      {/* Time Slot Selector */}
      <lable style={{ marginLeft: "1rem" }}>
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

      </lable>

      {/* Debug Output */}
      <div style={{ marginTop: "1rem" }}>
        <strong>Selected:</strong> {pickupDate || "No date"}{" "}
        {pickupTime || "No time"}
      </div>
      
    </div>
  )
};

export default PickupSelector;
