import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import About from './pages/About';



const App = () => {


  return (
    <BrowserRouter>
      <Routes>
        <Route path="/about" element={<About />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;