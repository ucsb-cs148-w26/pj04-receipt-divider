// TODO: implement join page
// - if no id in query params (?id=<groupId>), show "Scan a QR code to join a session"
// - if id present and not logged in, redirect to login page with redirect param
// - if id present and logged in, call endpoint /group/join with Bearer token
// - on success, redirect to /group/:roomId
// - show error state if join fails

export default function JoinPage() {
  return <p>JoinPage</p>;
}
