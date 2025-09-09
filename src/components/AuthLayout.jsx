export default function AuthLayout({ children }) {
  return (
    <div
      className="min-h-screen w-full grid place-items-center px-6"
      style={{
        background:
          "radial-gradient(60% 60% at 50% 10%, rgba(185, 28, 28, .25), rgba(0,0,0,0))," +
          "linear-gradient(180deg, #0f0f0f 0%, #111 40%, #0b0b0b 100%)",
      }}
    >
      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}
