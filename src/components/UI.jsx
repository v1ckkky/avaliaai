export function Button({ className = "", ...props }) {
  return (
    <button
      className={
        "w-full rounded-full py-3 px-4 font-semibold bg-red-700 hover:bg-red-600 disabled:opacity-60 transition " +
        className
      }
      {...props}
    />
  );
}

export function GhostButton({ className = "", ...props }) {
  return (
    <button
      className={
        "w-full rounded-full py-3 px-4 font-semibold bg-white/10 hover:bg-white/15 transition " +
        className
      }
      {...props}
    />
  );
}

export function Input({ className = "", ...props }) {
  return (
    <input
      className={
        "w-full rounded-xl px-3 py-3 bg-neutral-100 text-neutral-900 placeholder-neutral-500 outline-none " +
        className
      }
      {...props}
    />
  );
}

export function SubtleLink(props) {
  return (
    <a
      className="text-sm text-red-400 hover:text-red-300 underline-offset-2 hover:underline"
      {...props}
    />
  );
}
