type Props = {
    title: string;
    description: string;
    href: string;
};

export default function ServiceCard({ title, description, href }: Props) {
    return (
        <a href={href} className="card">
            <h3>{title}</h3>
            <p>{description}</p>
        </a>
    );
}