import { useRef, useEffect } from "react";

interface JarvisOrbProps {
  size?: number;
  isActive?: boolean;
  isSpeaking?: boolean;
  isConnecting?: boolean;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
}

interface Hexagon {
  x: number;
  y: number;
  brightness: number;
  targetBrightness: number;
}

const JarvisOrb = ({ 
  size = 48, 
  isActive = false, 
  isSpeaking = false,
  isConnecting = false,
  className = "" 
}: JarvisOrbProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const hexagonsRef = useRef<Hexagon[]>([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Get primary color from CSS
    const computedStyle = getComputedStyle(document.documentElement);
    const primaryHSLRaw = computedStyle.getPropertyValue("--primary").trim() || "199 89% 48%";
    const [h = "199", s = "89%", l = "48%"] = primaryHSLRaw.split(/\s+/);
    const getColor = (opacity: number, lightAdjust: number = 0) => {
      const adjustedL = Math.min(100, parseInt(l) + lightAdjust);
      return `hsla(${h}, ${s}, ${adjustedL}%, ${opacity})`;
    };

    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = size / 2 - 2;

    // Initialize particles
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 16; i++) {
        const angle = (Math.PI * 2 * i) / 16;
        const radius = maxRadius * (0.4 + Math.random() * 0.3);
        particlesRef.current.push({
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: 1 + Math.random() * 1.5,
          opacity: 0.3 + Math.random() * 0.5,
        });
      }
    }

    // Initialize hexagons
    if (hexagonsRef.current.length === 0) {
      const hexSize = 6;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const offsetX = row % 2 === 0 ? 0 : hexSize;
          hexagonsRef.current.push({
            x: col * hexSize * 2 + offsetX + size * 0.15,
            y: row * hexSize * 1.5 + size * 0.2,
            brightness: 0,
            targetBrightness: 0,
          });
        }
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, size, size);
      timeRef.current += 0.016;
      const time = timeRef.current;

      const intensity = isConnecting ? 0.5 : isActive ? (isSpeaking ? 1.2 : 0.8) : 0.4;

      // Layer 1: Hexagonal grid background
      hexagonsRef.current.forEach((hex) => {
        // Random flicker
        if (Math.random() < 0.02) {
          hex.targetBrightness = Math.random() * intensity * 0.3;
        }
        hex.brightness += (hex.targetBrightness - hex.brightness) * 0.1;
        hex.targetBrightness *= 0.95;

        if (hex.brightness > 0.01) {
          ctx.beginPath();
          const hexRadius = 3;
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const hx = hex.x + Math.cos(angle) * hexRadius;
            const hy = hex.y + Math.sin(angle) * hexRadius;
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.strokeStyle = getColor(hex.brightness * 0.5, 20);
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });

      // Layer 2: 3D Orbital rings
      for (let ring = 0; ring < 3; ring++) {
        const baseRadius = maxRadius * (0.5 + ring * 0.15);
        const tilt = 0.3 + ring * 0.2;
        const speed = (0.3 + ring * 0.15) * (isConnecting ? 3 : 1);
        const rotationOffset = time * speed + (ring * Math.PI) / 3;

        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * Math.PI * 2 + rotationOffset;
          const radius = baseRadius * (1 + Math.sin(angle * 2 + time) * 0.05);
          
          // 3D perspective effect
          const z = Math.sin(angle) * tilt;
          const perspectiveScale = 1 + z * 0.2;
          const x = centerX + Math.cos(angle) * radius * perspectiveScale;
          const y = centerY + Math.sin(angle) * radius * perspectiveScale * (1 - tilt * 0.3);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        
        const ringOpacity = (0.15 + ring * 0.1) * intensity;
        ctx.strokeStyle = getColor(ringOpacity, ring * 10);
        ctx.lineWidth = 1 + (2 - ring) * 0.3;
        ctx.stroke();
      }

      // Layer 3: Floating particles with connections
      particlesRef.current.forEach((particle, i) => {
        // Brownian motion
        particle.vx += (Math.random() - 0.5) * 0.05 * intensity;
        particle.vy += (Math.random() - 0.5) * 0.05 * intensity;
        
        // Damping
        particle.vx *= 0.98;
        particle.vy *= 0.98;
        
        // Center attraction
        const dx = centerX - particle.x;
        const dy = centerY - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > maxRadius * 0.7) {
          particle.vx += dx * 0.002;
          particle.vy += dy * 0.002;
        }
        
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Draw connections between nearby particles
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const other = particlesRef.current[j];
          const connDist = Math.sqrt(
            Math.pow(particle.x - other.x, 2) + Math.pow(particle.y - other.y, 2)
          );
          
          if (connDist < maxRadius * 0.5) {
            const connOpacity = (1 - connDist / (maxRadius * 0.5)) * 0.3 * intensity;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = getColor(connOpacity, 10);
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }

        // Draw particle
        const particleOpacity = particle.opacity * intensity;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (isSpeaking ? 1.3 : 1), 0, Math.PI * 2);
        ctx.fillStyle = getColor(particleOpacity, 20);
        ctx.fill();
      });

      // Layer 4: Audio reactive waves (when speaking)
      if (isSpeaking || isConnecting) {
        const waveCount = isSpeaking ? 3 : 2;
        for (let w = 0; w < waveCount; w++) {
          const waveProgress = ((time * (isSpeaking ? 1.5 : 0.8) + w * 0.3) % 1);
          const waveRadius = maxRadius * 0.3 + waveProgress * maxRadius * 0.6;
          const waveOpacity = (1 - waveProgress) * 0.4 * intensity;
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
          ctx.strokeStyle = getColor(waveOpacity, 15);
          ctx.lineWidth = 2 - waveProgress;
          ctx.stroke();
        }
      }

      // Layer 5: Pulsing core
      const coreSize = maxRadius * 0.25;
      const corePulse = 1 + Math.sin(time * 3) * 0.1 * intensity;
      
      // Core glow
      const glowGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, coreSize * corePulse * 2
      );
      glowGradient.addColorStop(0, getColor(0.6 * intensity, 30));
      glowGradient.addColorStop(0.5, getColor(0.3 * intensity, 20));
      glowGradient.addColorStop(1, getColor(0, 0));
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreSize * corePulse * 2, 0, Math.PI * 2);
      ctx.fillStyle = glowGradient;
      ctx.fill();

      // Core center
      const coreGradient = ctx.createRadialGradient(
        centerX - coreSize * 0.2, centerY - coreSize * 0.2, 0,
        centerX, centerY, coreSize * corePulse
      );
      coreGradient.addColorStop(0, getColor(0.9 * intensity, 40));
      coreGradient.addColorStop(0.7, getColor(0.7 * intensity, 20));
      coreGradient.addColorStop(1, getColor(0.4 * intensity, 0));
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreSize * corePulse, 0, Math.PI * 2);
      ctx.fillStyle = coreGradient;
      ctx.fill();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [size, isActive, isSpeaking, isConnecting]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size }}
    />
  );
};

export default JarvisOrb;
