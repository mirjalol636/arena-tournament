import Link from "next/link";

export default function NotFound() {
  return (
    <div className="admin-login">
      <h1>Sahifa topilmadi.</h1>
      <p>Bunday sahifa mavjud emas.</p>
      <Link className="button primary" href="/tournaments">
        Arenaga qaytish
      </Link>
    </div>
  );
}
