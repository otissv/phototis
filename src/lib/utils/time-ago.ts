export function timeAgo(
  date: Date,
  live = false,
  callback?: (date: string) => void
) {
  const target = date instanceof Date ? date : new Date(date)

  function getText() {
    const now = new Date()
    const diff = Math.floor((now - target) / 1000) // seconds difference

    const units = [
      { name: "yr", secs: 31536000 },
      { name: "month", secs: 2592000 },
      { name: "week", secs: 604800 },
      { name: "day", secs: 86400 },
      { name: "hr", secs: 3600 },
      { name: "min", secs: 60 },
      { name: "sec", secs: 1 },
    ]

    for (const unit of units) {
      const value = Math.floor(diff / unit.secs)
      if (value >= 1) {
        return `${value} ${unit.name}${value > 1 ? "s" : ""} ago`
      }
    }
    return "just now"
  }

  // If live mode is off, just return string
  if (!live) {
    return getText()
  }

  // If live mode is on, run callback immediately and then every minute
  if (typeof callback === "function") {
    callback(getText())
    const interval = setInterval(() => {
      callback(getText())
    }, 60 * 1000)

    return () => clearInterval(interval) // return cleanup function
  }

  throw new Error("When live=true, you must pass a callback(dateString).")
}
