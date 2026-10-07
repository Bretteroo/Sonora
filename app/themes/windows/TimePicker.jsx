import React from 'react'
import TimeField from '../../frontend/src/components/TimeField.jsx'

// The app's TimePicker (utilities/timepicker.xaml): the shared time field,
// drawn the Windows way -- the arrows inside the box (window-chrome.css).
export default function TimePicker({ className = '', ...props }) {
  return <TimeField className={`win-timepicker ${className}`} {...props} />
}
