export default function HomeButton({ onClick, label = '🏠 Home' }) {
  return (
    <button className="home-btn" onClick={onClick} aria-label="Go to main menu">
      {label}
    </button>
  )
}
