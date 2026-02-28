'use client';

import { useState } from 'react';

export default function Home() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    guests: '2',
    occasion: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Thank you for your reservation request! We will confirm shortly.');
  };

  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#1a3a2f]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <a href="#" className="font-display text-2xl text-[#c9a227] tracking-wide">
            The Copper Table
          </a>
          <div className="hidden md:flex items-center gap-8 font-body text-sm tracking-wider">
            <a href="#about" className="text-[#faf7f2] hover:text-[#c9a227] transition-colors">About</a>
            <a href="#menu" className="text-[#faf7f2] hover:text-[#c9a227] transition-colors">Menu</a>
            <a href="#gallery" className="text-[#faf7f2] hover:text-[#c9a227] transition-colors">Gallery</a>
            <a href="#visit" className="text-[#faf7f2] hover:text-[#c9a227] transition-colors">Visit</a>
            <a href="#reservations" className="bg-[#c9a227] text-[#1a3a2f] px-6 py-2 hover:bg-[#ddb832] transition-colors">
              Reserve a Table
            </a>
          </div>
          <button className="md:hidden text-[#faf7f2]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&q=80" 
            alt="The Copper Table restaurant interior with warm ambient lighting"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a3a2f]/70 via-[#1a3a2f]/50 to-[#1a3a2f]/80"></div>
        </div>
        <div className="relative z-10 text-center px-6 max-w-4xl">
          <p className="font-body text-[#c9a227] text-sm tracking-[0.3em] uppercase mb-6">Richmond, Virginia</p>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-[#faf7f2] mb-6 leading-tight">
            The Copper Table
          </h1>
          <p className="font-display text-2xl md:text-3xl text-[#faf7f2]/90 italic mb-4">
            Farm-to-Table Southern Cuisine
          </p>
          <p className="font-body text-[#faf7f2]/80 text-lg max-w-2xl mx-auto mb-10">
            Where tradition meets innovation. Celebrating Virginia&apos;s finest ingredients with recipes passed down through generations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#reservations" className="bg-[#c9a227] text-[#1a3a2f] font-body font-bold px-10 py-4 text-sm tracking-wider hover:bg-[#ddb832] transition-all hover:shadow-lg">
              MAKE A RESERVATION
            </a>
            <a href="#menu" className="border-2 border-[#faf7f2] text-[#faf7f2] font-body font-bold px-10 py-4 text-sm tracking-wider hover:bg-[#faf7f2] hover:text-[#1a3a2f] transition-all">
              VIEW MENU
            </a>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-8 h-8 text-[#c9a227]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-[#faf7f2]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=800&q=80" 
                alt="Chef Marcus Williams preparing a dish in the kitchen"
                className="w-full h-[500px] object-cover"
              />
              <div className="absolute -bottom-8 -right-8 bg-[#1a3a2f] text-[#faf7f2] p-8 hidden md:block">
                <p className="font-display text-4xl text-[#c9a227]">15+</p>
                <p className="font-body text-sm tracking-wider">YEARS OF CULINARY EXCELLENCE</p>
              </div>
            </div>
            <div>
              <p className="font-body text-[#c9a227] text-sm tracking-[0.3em] uppercase mb-4">Our Story</p>
              <h2 className="font-display text-4xl md:text-5xl text-[#1a3a2f] mb-8 leading-tight">
                A Passion for Southern Tradition
              </h2>
              <div className="font-body text-[#1a3a2f]/80 space-y-6 text-lg leading-relaxed">
                <p>
                  Nestled in the heart of Richmond&apos;s historic Carytown district, The Copper Table was born from a simple belief: the best meals come from the freshest ingredients, prepared with love and served with warmth.
                </p>
                <p>
                  Chef Marcus Williams, a Richmond native, trained at the Culinary Institute of America before returning home to honor his grandmother&apos;s recipes. Every dish tells a story—of family Sunday dinners, of farmers who wake before dawn, of a community that gathers around the table.
                </p>
                <p>
                  We partner with over 20 local farms within 50 miles of our kitchen, ensuring that every ingredient on your plate supports Virginia&apos;s agricultural heritage while delivering peak flavor and freshness.
                </p>
              </div>
              <div className="mt-10 flex items-center gap-6">
                <img 
                  src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&h=80&fit=crop&q=80" 
                  alt="Chef Marcus Williams"
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#c9a227]"
                />
                <div>
                  <p className="font-display text-xl text-[#1a3a2f]">Chef Marcus Williams</p>
                  <p className="font-body text-[#c9a227] text-sm">Executive Chef & Owner</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Menu Section */}
      <section id="menu" className="py-24 bg-[#1a3a2f]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="font-body text-[#c9a227] text-sm tracking-[0.3em] uppercase mb-4">Culinary Excellence</p>
            <h2 className="font-display text-4xl md:text-5xl text-[#faf7f2] mb-6">
              Seasonal Menu Highlights
            </h2>
            <p className="font-body text-[#faf7f2]/80 max-w-2xl mx-auto text-lg">
              Our menu changes with the seasons, celebrating Virginia&apos;s harvest at its peak. Here are a few current favorites.
            </p>
          </div>

          {/* Appetizers */}
          <div className="mb-16">
            <h3 className="font-display text-2xl text-[#c9a227] mb-8 text-center italic">Starters</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex gap-6 bg-[#faf7f2]/5 p-6 backdrop-blur">
                <img 
                  src="https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=200&h=200&fit=crop&q=80" 
                  alt="Crispy Fried Green Tomatoes"
                  className="w-28 h-28 object-cover flex-shrink-0"
                />
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-display text-xl text-[#faf7f2]">Crispy Fried Green Tomatoes</h4>
                    <span className="font-body text-[#c9a227]">$14</span>
                  </div>
                  <p className="font-body text-[#faf7f2]/70 text-sm">
                    Buttermilk-brined, cornmeal-crusted, served with pimento cheese and pepper jelly drizzle
                  </p>
                </div>
              </div>
              <div className="flex gap-6 bg-[#faf7f2]/5 p-6 backdrop-blur">
                <img 
                  src="https://images.unsplash.com/photo-1604909052743-94e838986d24?w=200&h=200&fit=crop&q=80" 
                  alt="She-Crab Soup"
                  className="w-28 h-28 object-cover flex-shrink-0"
                />
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-display text-xl text-[#faf7f2]">Virginia She-Crab Soup</h4>
                    <span className="font-body text-[#c9a227]">$16</span>
                  </div>
                  <p className="font-body text-[#faf7f2]/70 text-sm">
                    Rich and creamy, topped with dry sherry and fresh chives
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mains */}
          <div className="mb-16">
            <h3 className="font-display text-2xl text-[#c9a227] mb-8 text-center italic">Main Courses</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex gap-6 bg-[#faf7f2]/5 p-6 backdrop-blur">
                <img 
                  src="https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=200&h=200&fit=crop&q=80" 
                  alt="Pan-Seared Duck Breast"
                  className="w-28 h-28 object-cover flex-shrink-0"
                />
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-display text-xl text-[#faf7f2]">Pan-Seared Duck Breast</h4>
                    <span className="font-body text-[#c9a227]">$42</span>
                  </div>
                  <p className="font-body text-[#faf7f2]/70 text-sm">
                    Shenandoah Valley duck, blackberry gastrique, sweet potato puree, braised greens
                  </p>
                </div>
              </div>
              <div className="flex gap-6 bg-[#faf7f2]/5 p-6 backdrop-blur">
                <img 
                  src="https://images.unsplash.com/photo-1544025162-d76694265947?w=200&h=200&fit=crop&q=80" 
                  alt="Slow-Braised Short Ribs"
                  className="w-28 h-28 object-cover flex-shrink-0"
                />
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-display text-xl text-[#faf7f2]">Bourbon-Braised Short Ribs</h4>
                    <span className="font-body text-[#c9a227]">$38</span>
                  </div>
                  <p className="font-body text-[#faf7f2]/70 text-sm">
                    12-hour braised, Virginia bourbon glaze, stone-ground grits, roasted root vegetables
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Desserts */}
          <div>
            <h3 className="font-display text-2xl text-[#c9a227] mb-8 text-center italic">Sweet Endings</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex gap-6 bg-[#faf7f2]/5 p-6 backdrop-blur">
                <img 
                  src="https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=200&h=200&fit=crop&q=80" 
                  alt="Bourbon Pecan Pie"
                  className="w-28 h-28 object-cover flex-shrink-0"
                />
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-display text-xl text-[#faf7f2]">Bourbon Pecan Pie</h4>
                    <span className="font-body text-[#c9a227]">$12</span>
                  </div>
                  <p className="font-body text-[#faf7f2]/70 text-sm">
                    Grandma&apos;s recipe, Virginia pecans, house-made vanilla bean ice cream
                  </p>
                </div>
              </div>
              <div className="flex gap-6 bg-[#faf7f2]/5 p-6 backdrop-blur">
                <img 
                  src="https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=200&h=200&fit=crop&q=80" 
                  alt="Chocolate Layer Cake"
                  className="w-28 h-28 object-cover flex-shrink-0"
                />
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-display text-xl text-[#faf7f2]">Dark Chocolate Layer Cake</h4>
                    <span className="font-body text-[#c9a227]">$14</span>
                  </div>
                  <p className="font-body text-[#faf7f2]/70 text-sm">
                    Four layers of decadence, salted caramel drizzle, candied pecans
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-16">
            <a href="#" className="inline-block border-2 border-[#c9a227] text-[#c9a227] font-body font-bold px-10 py-4 text-sm tracking-wider hover:bg-[#c9a227] hover:text-[#1a3a2f] transition-all">
              VIEW FULL MENU
            </a>
          </div>
        </div>
      </section>

      {/* Ambiance Gallery */}
      <section id="gallery" className="py-24 bg-[#faf7f2]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="font-body text-[#c9a227] text-sm tracking-[0.3em] uppercase mb-4">Our Space</p>
            <h2 className="font-display text-4xl md:text-5xl text-[#1a3a2f] mb-6">
              An Atmosphere of Warmth
            </h2>
            <p className="font-body text-[#1a3a2f]/80 max-w-2xl mx-auto text-lg">
              Exposed brick, copper accents, and candlelit tables create the perfect setting for intimate dinners and celebrations alike.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2 row-span-2">
              <img 
                src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80" 
                alt="Main dining room with elegant table settings"
                className="w-full h-full object-cover min-h-[400px]"
              />
            </div>
            <div>
              <img 
                src="https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&q=80" 
                alt="Bar area with craft cocktails"
                className="w-full h-[200px] object-cover"
              />
            </div>
            <div>
              <img 
                src="https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=400&q=80" 
                alt="Private dining room"
                className="w-full h-[200px] object-cover"
              />
            </div>
            <div>
              <img 
                src="https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=400&q=80" 
                alt="Outdoor patio seating"
                className="w-full h-[200px] object-cover"
              />
            </div>
            <div>
              <img 
                src="https://images.unsplash.com/photo-1560624052-449f5ddf0c31?w=400&q=80" 
                alt="Kitchen pass with plated dishes"
                className="w-full h-[200px] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Hours & Location */}
      <section id="visit" className="py-24 bg-[#f0ebe3]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="font-body text-[#c9a227] text-sm tracking-[0.3em] uppercase mb-4">Visit Us</p>
              <h2 className="font-display text-4xl md:text-5xl text-[#1a3a2f] mb-8">
                Hours & Location
              </h2>
              
              <div className="space-y-8">
                <div>
                  <h3 className="font-display text-xl text-[#1a3a2f] mb-4">Address</h3>
                  <p className="font-body text-[#1a3a2f]/80 text-lg">
                    2847 Cary Street<br />
                    Richmond, VA 23221
                  </p>
                </div>
                
                <div>
                  <h3 className="font-display text-xl text-[#1a3a2f] mb-4">Hours</h3>
                  <div className="font-body text-[#1a3a2f]/80 space-y-2">
                    <div className="flex justify-between max-w-xs">
                      <span>Tuesday - Thursday</span>
                      <span>5:00 PM - 10:00 PM</span>
                    </div>
                    <div className="flex justify-between max-w-xs">
                      <span>Friday - Saturday</span>
                      <span>5:00 PM - 11:00 PM</span>
                    </div>
                    <div className="flex justify-between max-w-xs">
                      <span>Sunday</span>
                      <span>10:00 AM - 9:00 PM</span>
                    </div>
                    <div className="flex justify-between max-w-xs text-[#c9a227]">
                      <span>Monday</span>
                      <span>Closed</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-display text-xl text-[#1a3a2f] mb-4">Contact</h3>
                  <p className="font-body text-[#1a3a2f]/80 text-lg">
                    <a href="tel:+18045553456" className="hover:text-[#c9a227] transition-colors">(804) 555-3456</a><br />
                    <a href="mailto:hello@thecoppertable.com" className="hover:text-[#c9a227] transition-colors">hello@thecoppertable.com</a>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-[#1a3a2f] h-[400px] flex items-center justify-center">
              <div className="text-center text-[#faf7f2]/60">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="font-body text-sm tracking-wider">INTERACTIVE MAP</p>
                <p className="font-body text-xs mt-2 opacity-60">Carytown District, Richmond VA</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reservation Form */}
      <section id="reservations" className="py-24 bg-[#1a3a2f]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="font-body text-[#c9a227] text-sm tracking-[0.3em] uppercase mb-4">Book Your Experience</p>
            <h2 className="font-display text-4xl md:text-5xl text-[#faf7f2] mb-6">
              Make a Reservation
            </h2>
            <p className="font-body text-[#faf7f2]/80 text-lg">
              Join us for an unforgettable dining experience. For parties larger than 8, please call us directly.
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block font-body text-[#faf7f2] text-sm mb-2 tracking-wider">Full Name *</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[#faf7f2]/10 border border-[#faf7f2]/30 text-[#faf7f2] px-4 py-3 font-body focus:outline-none focus:border-[#c9a227] transition-colors"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block font-body text-[#faf7f2] text-sm mb-2 tracking-wider">Email Address *</label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-[#faf7f2]/10 border border-[#faf7f2]/30 text-[#faf7f2] px-4 py-3 font-body focus:outline-none focus:border-[#c9a227] transition-colors"
                  placeholder="john@example.com"
                />
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block font-body text-[#faf7f2] text-sm mb-2 tracking-wider">Phone Number *</label>
                <input 
                  type="tel" 
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-[#faf7f2]/10 border border-[#faf7f2]/30 text-[#faf7f2] px-4 py-3 font-body focus:outline-none focus:border-[#c9a227] transition-colors"
                  placeholder="(804) 555-0000"
                />
              </div>
              <div>
                <label className="block font-body text-[#faf7f2] text-sm mb-2 tracking-wider">Number of Guests *</label>
                <select 
                  required
                  value={formData.guests}
                  onChange={(e) => setFormData({...formData, guests: e.target.value})}
                  className="w-full bg-[#faf7f2]/10 border border-[#faf7f2]/30 text-[#faf7f2] px-4 py-3 font-body focus:outline-none focus:border-[#c9a227] transition-colors"
                >
                  <option value="1">1 Guest</option>
                  <option value="2">2 Guests</option>
                  <option value="3">3 Guests</option>
                  <option value="4">4 Guests</option>
                  <option value="5">5 Guests</option>
                  <option value="6">6 Guests</option>
                  <option value="7">7 Guests</option>
                  <option value="8">8 Guests</option>
                </select>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block font-body text-[#faf7f2] text-sm mb-2 tracking-wider">Preferred Date *</label>
                <input 
                  type="date" 
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full bg-[#faf7f2]/10 border border-[#faf7f2]/30 text-[#faf7f2] px-4 py-3 font-body focus:outline-none focus:border-[#c9a227] transition-colors"
                />
              </div>
              <div>
                <label className="block font-body text-[#faf7f2] text-sm mb-2 tracking-wider">Preferred Time *</label>
                <select 
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  className="w-full bg-[#faf7f2]/10 border border-[#faf7f2]/30 text-[#faf7f2] px-4 py-3 font-body focus:outline-none focus:border-[#c9a227] transition-colors"
                >
                  <option value="">Select a time</option>
                  <option value="17:00">5:00 PM</option>
                  <option value="17:30">5:30 PM</option>
                  <option value="18:00">6:00 PM</option>
                  <option value="18:30">6:30 PM</option>
                  <option value="19:00">7:00 PM</option>
                  <option value="19:30">7:30 PM</option>
                  <option value="20:00">8:00 PM</option>
                  <option value="20:30">8:30 PM</option>
                  <option value="21:00">9:00 PM</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block font-body text-[#faf7f2] text-sm mb-2 tracking-wider">Special Occasion</label>
              <select 
                value={formData.occasion}
                onChange={(e) => setFormData({...formData, occasion: e.target.value})}
                className="w-full bg-[#faf7f2]/10 border border-[#faf7f2]/30 text-[#faf7f2] px-4 py-3 font-body focus:outline-none focus:border-[#c9a227] transition-colors"
              >
                <option value="">None</option>
                <option value="birthday">Birthday</option>
                <option value="anniversary">Anniversary</option>
                <option value="date">Date Night</option>
                <option value="business">Business Dinner</option>
                <option value="other">Other Celebration</option>
              </select>
            </div>
            
            <div>
              <label className="block font-body text-[#faf7f2] text-sm mb-2 tracking-wider">Special Requests or Dietary Restrictions</label>
              <textarea 
                rows={4}
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full bg-[#faf7f2]/10 border border-[#faf7f2]/30 text-[#faf7f2] px-4 py-3 font-body focus:outline-none focus:border-[#c9a227] transition-colors resize-none"
                placeholder="Please let us know about any allergies, dietary restrictions, or special requests..."
              ></textarea>
            </div>
            
            <button 
              type="submit"
              className="w-full bg-[#c9a227] text-[#1a3a2f] font-body font-bold py-4 text-sm tracking-wider hover:bg-[#ddb832] transition-all"
            >
              REQUEST RESERVATION
            </button>
            
            <p className="text-center font-body text-[#faf7f2]/60 text-sm">
              For same-day reservations or parties of 8+, please call <a href="tel:+18045553456" className="text-[#c9a227] hover:underline">(804) 555-3456</a>
            </p>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f231c] py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <h3 className="font-display text-3xl text-[#c9a227] mb-4">The Copper Table</h3>
              <p className="font-body text-[#faf7f2]/70 text-sm leading-relaxed max-w-md">
                Farm-to-table Southern cuisine in the heart of Richmond. Celebrating Virginia&apos;s agricultural heritage with every dish.
              </p>
              <div className="flex gap-4 mt-6">
                <a href="#" className="w-10 h-10 bg-[#faf7f2]/10 flex items-center justify-center hover:bg-[#c9a227] transition-colors group">
                  <svg className="w-5 h-5 text-[#faf7f2] group-hover:text-[#1a3a2f]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 bg-[#faf7f2]/10 flex items-center justify-center hover:bg-[#c9a227] transition-colors group">
                  <svg className="w-5 h-5 text-[#faf7f2] group-hover:text-[#1a3a2f]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a href="#" className="w-10 h-10 bg-[#faf7f2]/10 flex items-center justify-center hover:bg-[#c9a227] transition-colors group">
                  <svg className="w-5 h-5 text-[#faf7f2] group-hover:text-[#1a3a2f]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
                  </svg>
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="font-display text-lg text-[#faf7f2] mb-4">Quick Links</h4>
              <ul className="font-body text-[#faf7f2]/70 text-sm space-y-3">
                <li><a href="#about" className="hover:text-[#c9a227] transition-colors">Our Story</a></li>
                <li><a href="#menu" className="hover:text-[#c9a227] transition-colors">Menu</a></li>
                <li><a href="#gallery" className="hover:text-[#c9a227] transition-colors">Gallery</a></li>
                <li><a href="#reservations" className="hover:text-[#c9a227] transition-colors">Reservations</a></li>
                <li><a href="#" className="hover:text-[#c9a227] transition-colors">Private Events</a></li>
                <li><a href="#" className="hover:text-[#c9a227] transition-colors">Gift Cards</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-display text-lg text-[#faf7f2] mb-4">Contact</h4>
              <ul className="font-body text-[#faf7f2]/70 text-sm space-y-3">
                <li>2847 Cary Street</li>
                <li>Richmond, VA 23221</li>
                <li className="pt-2">
                  <a href="tel:+18045553456" className="hover:text-[#c9a227] transition-colors">(804) 555-3456</a>
                </li>
                <li>
                  <a href="mailto:hello@thecoppertable.com" className="hover:text-[#c9a227] transition-colors">hello@thecoppertable.com</a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-[#faf7f2]/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="font-body text-[#faf7f2]/50 text-sm">
              © 2024 The Copper Table. All rights reserved.
            </p>
            <div className="font-body text-[#faf7f2]/50 text-sm flex gap-6">
              <a href="#" className="hover:text-[#c9a227] transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-[#c9a227] transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
