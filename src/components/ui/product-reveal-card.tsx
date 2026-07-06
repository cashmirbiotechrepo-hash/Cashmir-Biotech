"use client"

import { motion, useReducedMotion } from "framer-motion"
import { buttonVariants } from "@/components/ui/button"
import { ShoppingCart, Star, Heart } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface ProductRevealCardProps {
  name?: string
  price?: string
  originalPrice?: string
  image?: string
  description?: string
  rating?: number
  reviewCount?: number
  onAdd?: () => void
  onFavorite?: () => void
  enableAnimations?: boolean
  className?: string
}

export function ProductRevealCard({
  name = "Premium Wireless Headphones",
  price = "$199",
  originalPrice = "$299",
  image = "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&h=600&fit=crop", // Premium headphones
  description = "Experience studio-quality sound with advanced noise cancellation and 30-hour battery life. Perfect for music lovers and professionals.",
  rating = 4.8,
  reviewCount = 124,
  onAdd,
  onFavorite,
  enableAnimations = true,
  className,
}: ProductRevealCardProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const shouldReduceMotion = useReducedMotion()
  const shouldAnimate = enableAnimations && !shouldReduceMotion

  const handleFavorite = () => {
    setIsFavorite(!isFavorite)
    onFavorite?.()
  }

  const containerVariants = {
    rest: { 
      scale: 1,
      y: 0,
      filter: "blur(0px)",
    },
    hover: shouldAnimate ? { 
      scale: 1.03, 
      y: -8,
      filter: "blur(0px)",
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        mass: 0.8,
      }
    } : {},
  }

  const imageVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.1 },
  }

  const overlayVariants = {
    rest: { 
      y: "100%", 
      opacity: 0,
    },
    hover: { 
      y: "0%", 
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 28,
        mass: 0.6,
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  }

  const backdropVariants = {
    rest: { opacity: 0 },
    hover: { 
      opacity: 1,
      transition: { duration: 0.3, ease: "easeOut" }
    },
  }

  const contentVariants = {
    rest: { 
      opacity: 0, 
      y: 20,
      scale: 0.95,
    },
    hover: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 25,
        mass: 0.5,
      },
    },
  }

  const buttonVariants_motion = {
    rest: { scale: 1, y: 0 },
    hover: shouldAnimate ? { 
      scale: 1.05, 
      y: -2,
      transition: { 
        type: "spring", 
        stiffness: 400, 
        damping: 25 
      }
    } : {},
    tap: shouldAnimate ? { scale: 0.95 } : {},
  }

  const favoriteVariants = {
    rest: { scale: 1, rotate: 0 },
    favorite: { 
      scale: [1, 1.3, 1], 
      rotate: [0, 10, -10, 0],
      transition: { 
        duration: 0.5,
        ease: "easeInOut"
      }
    },
  }

  return (
    <motion.div
      data-slot="product-reveal-card"
      initial="rest"
      whileHover="hover"
      variants={containerVariants}
      className={cn(
        "relative w-full rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl text-white overflow-hidden",
        "shadow-[0_8px_40px_rgb(0,0,0,0.5)] cursor-pointer group",
        className
      )}
    >
      {/* Image Container */}
      <div className="relative overflow-hidden aspect-square">
        <motion.img
          src={image}
          alt={name}
          className="h-full w-full object-cover"
          variants={imageVariants}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        {/* Favorite Button */}
        <motion.button
          onClick={handleFavorite}
          variants={favoriteVariants}
          animate={isFavorite ? "favorite" : "rest"}
          className={cn(
            "absolute top-4 right-4 p-2.5 rounded-full backdrop-blur-md border border-white/20 transition-colors",
            isFavorite 
              ? "bg-red-500 text-white" 
              : "bg-black/40 text-white hover:bg-black/60"
          )}
        >
          <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
        </motion.button>

        {/* Discount Badge */}
        {originalPrice && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="absolute top-4 left-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold shadow-lg"
          >
            {Math.round(((parseFloat(originalPrice.replace(/[^\d.]/g, '')) - parseFloat(price.replace(/[^\d.]/g, ''))) / parseFloat(originalPrice.replace(/[^\d.]/g, ''))) * 100)}% OFF
          </motion.div>
        )}
      </div>

      {/* Content */}
      <motion.div 
        variants={{ rest: { opacity: 1 }, hover: { opacity: 0, transition: { duration: 0.2 } } }}
        className="p-6 space-y-3 relative z-10"
      >
        {/* Rating */}
        <div className="flex items-center gap-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-3.5 h-3.5",
                  i < Math.floor(rating) 
                    ? "text-primary fill-primary" 
                    : "text-white/20"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-white/50 font-medium">
            ({reviewCount} reviews)
          </span>
        </div>

        {/* Product Info */}
        <div className="space-y-1">
          <h3 className="text-xl font-bold leading-tight tracking-tight [font-family:var(--font-headline)]">
            {name}
          </h3>
          
          <div className="flex items-center gap-3 pt-1">
            <span className="text-2xl font-bold text-primary">{price}</span>
            {originalPrice && (
              <span className="text-sm font-medium text-white/40 line-through">
                {originalPrice}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stationary Backdrop Blur Layer */}
      <motion.div
        variants={backdropVariants}
        className="absolute inset-0 bg-black/80 backdrop-blur-2xl z-10 rounded-3xl pointer-events-none"
      />

      {/* Reveal Overlay (Text & Buttons Only) */}
      <motion.div
        variants={overlayVariants}
        className="absolute inset-0 flex flex-col justify-end border border-white/10 rounded-3xl z-20 overflow-hidden"
      >
        <div className="p-6 space-y-5">
          {/* Product Description */}
          <motion.div variants={contentVariants}>
            <h4 className="font-semibold text-white mb-2 uppercase tracking-widest text-[10px] text-primary">Details</h4>
            <p className="text-sm text-white/70 leading-relaxed">
              {description}
            </p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div variants={contentVariants} className="space-y-3 pt-2">
            <motion.button
              onClick={onAdd}
              variants={buttonVariants_motion}
              initial="rest"
              whileHover="hover"
              whileTap="tap"
              className={cn(
                buttonVariants({ variant: "default" }), 
                "w-full h-12 font-bold rounded-xl",
                "bg-gradient-to-r from-primary to-[rgb(250_204_21)] text-black",
                "hover:brightness-110",
                "shadow-[0_0_20px_rgba(250,204,21,0.3)]"
              )}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add to Cart
            </motion.button>
            
            <motion.button
              variants={buttonVariants_motion}
              initial="rest"
              whileHover="hover"
              whileTap="tap"
              className={cn(
                buttonVariants({ variant: "outline" }), 
                "w-full h-10 font-semibold rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              )}
            >
              View Details
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}
