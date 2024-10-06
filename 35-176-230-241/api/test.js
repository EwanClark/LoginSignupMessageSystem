import moment from 'moment'

const currentUTC = moment.utc(); // Get the current UTC time
console.log(currentUTC.format('YYYY-MM-DD HH:mm:ss')); // Format it