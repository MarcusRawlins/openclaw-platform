'use client';

import { useState } from 'react';

// Unsplash images for the site
const images = {
  hero: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80', // Luxury home exterior
  agent: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80', // Professional woman
  about: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80', // Real estate keys
  properties: [
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80', // Modern luxury home
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80', // Villa
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', // Mansion
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80', // Modern interior
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80', // Pool house
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80', // Luxury kitchen
  ],
  testimonials: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80', // Man 1
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80', // Woman 1
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80', // Man 2
  ],
};

const properties = [
  { image: images.properties[0], price: '$2,450,000', address: '1847 Grandview Estate', beds: 5, baths: 4, sqft: '4,850' },
  { image: images.properties[1], price: '$1,895,000', address: '892 Lakeside Manor', beds: 4, baths: 3, sqft: '3,920' },
  { image: images.properties[2], price: '$3,200,000', address: '2451 Heritage Hills', beds: 6, baths: 5, sqft: '6,200' },
  { image: images.properties[3], price: '$1,650,000', address: '567 Modern Oaks Dr', beds: 4, baths: 4, sqft: '3,450' },
  { image: images.properties[4], price: '$2,100,000', address: '1203 Country Club Ln', beds: 5, baths: 4, sqft: '4,100' },
  { image: images.properties[5], price: '$1,425,000', address: '789 Executive Plaza', beds: 3, baths: 3, sqft: '2,890' },
];

const services = [
  { icon: '🏠', title: 'Buyer Representation', desc: 'Find your dream home with personalized guidance through every step of the buying process.' },
  { icon: '💰', title: 'Seller Services', desc: 'Strategic marketing and expert negotiation to maximize your property\'s value.' },
  { icon: '📈', title: 'Investment Properties', desc: 'Identify lucrative investment opportunities with comprehensive market analysis.' },
  { icon: '🚚', title: 'Relocation Services', desc: 'Seamless transitions for families and executives moving to the Greensboro area.' },
];

const testimonials = [
  { name: 'Michael Richardson', role: 'Home Buyer', image: images.testimonials[0], text: 'Sarah made our first home purchase absolutely seamless. Her knowledge of the luxury market in Greensboro is unmatched. She found us a home that exceeded all our expectations.' },
  { name: 'Jennifer Collins', role: 'Home Seller', image: images.testimonials[1], text: 'We sold our home in just 12 days and above asking price! Sarah\'s marketing strategy and professional network are truly impressive. Couldn\'t recommend her more highly.' },
  { name: 'David Thompson', role: 'Investor', image: images.testimonials[2], text: 'Working with Sarah on multiple investment properties has been incredibly rewarding. Her market insights have helped me build a portfolio I\'m proud of.' },
];

const stats = [
  { value: '15+', label: 'Years Experience' },
  { value: '500+', label: 'Homes Sold' },
  { value: '$450M', label: 'Total Sales Volume' },
  { value: '98%', label: 'Client Satisfaction' },
];

export default function Home() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Thank you for your inquiry! Sarah will contact you within 24 hours.');
    setFormData({ name: '', email: '', phone: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-[#1a1a2e]/95 backdrop-blur-sm border-b border-[#d4af37]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-2">
              <span className="text-[#d4af37] text-2xl">✦</span>
              <span className="text-xl font-light tracking-wider">SARAH MITCHELL</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#listings" className="text-gray-300 hover:text-[#d4af37] transition">Listings</a>
              <a href="#about" className="text-gray-300 hover:text-[#d4af37] transition">About</a>
              <a href="#services" className="text-gray-300 hover:text-[#d4af37] transition">Services</a>
              <a href="#testimonials" className="text-gray-300 hover:text-[#d4af37] transition">Testimonials</a>
              <a href="#contact" className="bg-[#d4af37] text-[#1a1a2e] px-6 py-2 hover:bg-[#c4a030] transition font-medium">
                Contact
              </a>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-2">
              <a href="#listings" className="block py-2 text-gray-300 hover:text-[#d4af37]">Listings</a>
              <a href="#about" className="block py-2 text-gray-300 hover:text-[#d4af37]">About</a>
              <a href="#services" className="block py-2 text-gray-300 hover:text-[#d4af37]">Services</a>
              <a href="#testimonials" className="block py-2 text-gray-300 hover:text-[#d4af37]">Testimonials</a>
              <a href="#contact" className="block py-2 text-[#d4af37]">Contact</a>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center">
        <div className="absolute inset-0">
          <img 
            src={images.hero}
            alt="Luxury home"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a2e] via-[#1a1a2e]/80 to-transparent" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
          <div className="max-w-2xl">
            <p className="text-[#d4af37] tracking-[0.3em] text-sm mb-4">LUXURY HOMES REALTY</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light leading-tight mb-6">
              Your Trusted Partner in <span className="text-[#d4af37]">Luxury Real Estate</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Experience exceptional service and unparalleled market expertise in Greensboro&apos;s most prestigious neighborhoods.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="#listings"
                className="bg-[#d4af37] text-[#1a1a2e] px-8 py-4 text-center hover:bg-[#c4a030] transition font-medium tracking-wide"
              >
                VIEW LISTINGS
              </a>
              <a 
                href="tel:3365558900"
                className="border-2 border-white/30 text-white px-8 py-4 text-center hover:border-[#d4af37] hover:text-[#d4af37] transition tracking-wide"
              >
                CALL (336) 555-8900
              </a>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-[#d4af37] rounded-full mt-2" />
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-[#d4af37] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-light text-[#1a1a2e] mb-2">{stat.value}</div>
                <div className="text-[#1a1a2e]/70 uppercase tracking-wider text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      <section id="listings" className="py-24 bg-[#0f0f1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[#d4af37] tracking-[0.3em] text-sm mb-4">EXCLUSIVE PROPERTIES</p>
            <h2 className="text-3xl md:text-4xl font-light">Featured Listings</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map((property, index) => (
              <div key={index} className="group bg-[#1a1a2e] overflow-hidden">
                <div className="relative overflow-hidden">
                  <img 
                    src={property.image}
                    alt={property.address}
                    className="w-full h-64 object-cover group-hover:scale-110 transition duration-500"
                  />
                  <div className="absolute top-4 left-4 bg-[#d4af37] text-[#1a1a2e] px-4 py-1 font-medium">
                    {property.price}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-light mb-3">{property.address}</h3>
                  <div className="flex items-center space-x-4 text-gray-400 text-sm">
                    <span>{property.beds} Beds</span>
                    <span className="text-[#d4af37]">•</span>
                    <span>{property.baths} Baths</span>
                    <span className="text-[#d4af37]">•</span>
                    <span>{property.sqft} Sq Ft</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <a 
              href="#contact"
              className="inline-block border-2 border-[#d4af37] text-[#d4af37] px-8 py-4 hover:bg-[#d4af37] hover:text-[#1a1a2e] transition font-medium tracking-wide"
            >
              VIEW ALL LISTINGS
            </a>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-[#1a1a2e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <img 
                src={images.agent}
                alt="Sarah Mitchell"
                className="w-full h-[600px] object-cover"
              />
              <div className="absolute -bottom-6 -right-6 bg-[#d4af37] p-8 hidden md:block">
                <div className="text-[#1a1a2e] text-5xl font-light">15+</div>
                <div className="text-[#1a1a2e]/80 uppercase tracking-wider text-sm">Years of Excellence</div>
              </div>
            </div>

            <div>
              <p className="text-[#d4af37] tracking-[0.3em] text-sm mb-4">ABOUT SARAH</p>
              <h2 className="text-3xl md:text-4xl font-light mb-6">Dedicated to Your Success</h2>
              <p className="text-gray-300 leading-relaxed mb-6">
                With over 15 years of experience in Greensboro&apos;s luxury real estate market, I&apos;ve built my reputation on exceptional service, market expertise, and an unwavering commitment to my clients&apos; goals.
              </p>
              <p className="text-gray-300 leading-relaxed mb-6">
                As a top-producing agent at Luxury Homes Realty, I&apos;ve helped hundreds of families find their perfect home and guided sellers to achieve record-breaking sales. My deep knowledge of the Triad area&apos;s most prestigious neighborhoods ensures you receive the insight and guidance you deserve.
              </p>
              <p className="text-gray-300 leading-relaxed mb-8">
                Whether you&apos;re buying your first luxury home or selling an estate property, I bring the same passion, professionalism, and attention to detail to every transaction.
              </p>

              <div className="flex flex-wrap gap-4">
                <div className="bg-[#0f0f1a] px-6 py-4">
                  <div className="text-[#d4af37] text-2xl font-light">500+</div>
                  <div className="text-gray-400 text-sm">Homes Sold</div>
                </div>
                <div className="bg-[#0f0f1a] px-6 py-4">
                  <div className="text-[#d4af37] text-2xl font-light">$450M</div>
                  <div className="text-gray-400 text-sm">Total Sales</div>
                </div>
                <div className="bg-[#0f0f1a] px-6 py-4">
                  <div className="text-[#d4af37] text-2xl font-light">#1</div>
                  <div className="text-gray-400 text-sm">Agent 2023</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 bg-[#0f0f1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[#d4af37] tracking-[0.3em] text-sm mb-4">WHAT I OFFER</p>
            <h2 className="text-3xl md:text-4xl font-light">My Services</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((service, index) => (
              <div key={index} className="bg-[#1a1a2e] p-8 group hover:bg-[#d4af37] transition duration-300">
                <div className="text-5xl mb-6">{service.icon}</div>
                <h3 className="text-xl font-light mb-4 group-hover:text-[#1a1a2e]">{service.title}</h3>
                <p className="text-gray-400 group-hover:text-[#1a1a2e]/80 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-[#1a1a2e]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[#d4af37] tracking-[0.3em] text-sm mb-4">CLIENT STORIES</p>
            <h2 className="text-3xl md:text-4xl font-light">What My Clients Say</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-[#0f0f1a] p-8">
                <div className="flex items-center mb-6">
                  <img 
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full object-cover mr-4"
                  />
                  <div>
                    <div className="font-medium">{testimonial.name}</div>
                    <div className="text-[#d4af37] text-sm">{testimonial.role}</div>
                  </div>
                </div>
                <div className="text-[#d4af37] text-4xl mb-4">&ldquo;</div>
                <p className="text-gray-300 leading-relaxed">{testimonial.text}</p>
                <div className="flex mt-6 text-[#d4af37]">
                  {'★★★★★'.split('').map((star, i) => (
                    <span key={i}>{star}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-[#0f0f1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <p className="text-[#d4af37] tracking-[0.3em] text-sm mb-4">GET IN TOUCH</p>
              <h2 className="text-3xl md:text-4xl font-light mb-6">Ready to Make a Move?</h2>
              <p className="text-gray-300 leading-relaxed mb-8">
                Whether you&apos;re looking to buy, sell, or simply explore your options, I&apos;m here to help. Reach out today for a complimentary consultation.
              </p>

              <div className="space-y-6 mb-8">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-[#d4af37] flex items-center justify-center mr-4">
                    <span className="text-[#1a1a2e] text-xl">📱</span>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Phone</div>
                    <a href="tel:3365558900" className="text-xl hover:text-[#d4af37] transition">(336) 555-8900</a>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-[#d4af37] flex items-center justify-center mr-4">
                    <span className="text-[#1a1a2e] text-xl">✉️</span>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Email</div>
                    <a href="mailto:sarah@luxuryhomesrealty.com" className="text-xl hover:text-[#d4af37] transition">sarah@luxuryhomesrealty.com</a>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-[#d4af37] flex items-center justify-center mr-4">
                    <span className="text-[#1a1a2e] text-xl">📍</span>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Office</div>
                    <div className="text-xl">Greensboro, NC</div>
                  </div>
                </div>
              </div>

              <a 
                href="tel:3365558900"
                className="inline-block bg-[#d4af37] text-[#1a1a2e] px-8 py-4 hover:bg-[#c4a030] transition font-medium tracking-wide text-lg"
              >
                CALL NOW — (336) 555-8900
              </a>
            </div>

            <div className="bg-[#1a1a2e] p-8 lg:p-12">
              <h3 className="text-2xl font-light mb-6">Send a Message</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#0f0f1a] border border-gray-700 px-4 py-3 focus:border-[#d4af37] focus:outline-none transition"
                    required
                  />
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#0f0f1a] border border-gray-700 px-4 py-3 focus:border-[#d4af37] focus:outline-none transition"
                    required
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[#0f0f1a] border border-gray-700 px-4 py-3 focus:border-[#d4af37] focus:outline-none transition"
                  />
                </div>
                <div>
                  <textarea
                    placeholder="How can I help you?"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={4}
                    className="w-full bg-[#0f0f1a] border border-gray-700 px-4 py-3 focus:border-[#d4af37] focus:outline-none transition resize-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#d4af37] text-[#1a1a2e] px-8 py-4 hover:bg-[#c4a030] transition font-medium tracking-wide"
                >
                  SEND MESSAGE
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a1a2e] border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-[#d4af37] text-2xl">✦</span>
                <span className="text-xl font-light tracking-wider">SARAH MITCHELL</span>
              </div>
              <p className="text-gray-400">
                Your trusted partner in luxury real estate. Serving Greensboro and the Triad area with excellence for over 15 years.
              </p>
            </div>

            <div>
              <h4 className="text-lg font-light mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#listings" className="hover:text-[#d4af37] transition">Featured Listings</a></li>
                <li><a href="#about" className="hover:text-[#d4af37] transition">About Sarah</a></li>
                <li><a href="#services" className="hover:text-[#d4af37] transition">Services</a></li>
                <li><a href="#contact" className="hover:text-[#d4af37] transition">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-light mb-4">Contact Info</h4>
              <ul className="space-y-2 text-gray-400">
                <li>(336) 555-8900</li>
                <li>sarah@luxuryhomesrealty.com</li>
                <li>Greensboro, NC</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
            <p>&copy; 2024 Sarah Mitchell | Luxury Homes Realty. All rights reserved.</p>
            <p className="mt-4 md:mt-0">NC Real Estate License #NC-12345</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
