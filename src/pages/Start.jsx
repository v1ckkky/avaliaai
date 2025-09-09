import AuthLayout from "../components/AuthLayout";
import { Button, GhostButton } from "../components/UI";
import { Link } from "react-router-dom";

export default function Start() {
  return (
    <AuthLayout>
      <div className="text-center mb-8">
        <div className="mx-auto mb-6 w-14 h-14 rounded-full grid place-items-center bg-white/10">
          <span className="text-3xl">✓</span>
        </div>
        <h1 className="text-4xl font-bold">Avalia Aí</h1>
      </div>

      <div className="space-y-4">
        <Link to="/login">
          <Button>Login</Button>
        </Link>
        <Link to="/signup">
          <GhostButton>Criar Conta</GhostButton>
        </Link>
      </div>
    </AuthLayout>
  );
}
