import { useEffect, useRef } from "react";

interface AISpectrumProps {
  className?: string;
  size?: number;
}

const AISpectrum = ({ className = "", size = 80 }: AISpectrumProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get primary color from CSS variables (Canvas needs a concrete color string; no var())
    const computedStyle = getComputedStyle(document.documentElement);
    const primaryHSLRaw =
      computedStyle.getPropertyValue("--primary").trim() || "199 89% 48%";
    const [h = "199", s = "89%", l = "48%"] = primaryHSLRaw.split(/\s+/);

    const getColor = (opacity: number) => `hsla(${h}, ${s}, ${l}, ${opacity})`;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let time = 0;
    const centerX = size / 2;
    const centerY = size / 2;

    const animate = () => {
      ctx.clearRect(0, 0, size, size);
      time += 0.02;

      // Draw rotating rings
      for (let ring = 0; ring < 3; ring++) {
        const radius = 12 + ring * 10;
        const rotation = time * (1 - ring * 0.3);
        const opacity = 0.3 + ring * 0.2;

        ctx.beginPath();
        ctx.strokeStyle = getColor(opacity);
        ctx.lineWidth = 1;

        for (let i = 0; i < 360; i += 2) {
          const angle = (i * Math.PI) / 180 + rotation;
          const wave = Math.sin(angle * 6 + time * 2) * 2;
          const r = radius + wave;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();
      }

      // Draw spectrum bars in circular pattern
      const barCount = 24;
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const frequency = Math.sin(time * 3 + i * 0.5) * 0.5 + 0.5;
        const barHeight = 6 + frequency * 12;
        const innerRadius = 8;

        const x1 = centerX + Math.cos(angle) * innerRadius;
        const y1 = centerY + Math.sin(angle) * innerRadius;
        const x2 = centerX + Math.cos(angle) * (innerRadius + barHeight);
        const y2 = centerY + Math.sin(angle) * (innerRadius + barHeight);

        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, getColor(0.3));
        gradient.addColorStop(1, getColor(0.6 + frequency * 0.4));

        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Draw center core with pulse
      const pulseSize = 4 + Math.sin(time * 4) * 1.5;
      const coreGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, pulseSize * 2
      );
      coreGradient.addColorStop(0, getColor(1));
      coreGradient.addColorStop(0.5, getColor(0.5));
      coreGradient.addColorStop(1, getColor(0));

      ctx.beginPath();
      ctx.fillStyle = coreGradient;
      ctx.arc(centerX, centerY, pulseSize * 2, 0, Math.PI * 2);
      ctx.fill();

      // Draw orbiting particles
      for (let p = 0; p < 6; p++) {
        const orbitRadius = 25 + (p % 2) * 8;
        const speed = 0.8 + p * 0.2;
        const particleAngle = time * speed + (p / 6) * Math.PI * 2;
        const px = centerX + Math.cos(particleAngle) * orbitRadius;
        const py = centerY + Math.sin(particleAngle) * orbitRadius;
        const particleSize = 1.5 + Math.sin(time * 2 + p) * 0.5;

        ctx.beginPath();
        ctx.fillStyle = getColor(0.9);
        ctx.arc(px, py, particleSize, 0, Math.PI * 2);
        ctx.fill();

        // Particle trail
        for (let t = 1; t <= 3; t++) {
          const trailAngle = particleAngle - t * 0.1;
          const tx = centerX + Math.cos(trailAngle) * orbitRadius;
          const ty = centerY + Math.sin(trailAngle) * orbitRadius;
          ctx.beginPath();
          ctx.fillStyle = getColor(0.3 - t * 0.08);
          ctx.arc(tx, ty, particleSize * (1 - t * 0.2), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size }}
    />
  );
};

export default AISpectrum;
