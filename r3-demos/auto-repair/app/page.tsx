'use client';

import { useState } from 'react';

// Unsplash images for auto repair shop
const images = {
  hero: 'https://images.unsplash.com/photo-1625047509248-ec889cbff17f?w=1920&q=80',
  oilChange: 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=600&q=80',
  brakes: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  engine: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&q=80',
  tires: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=600&q=80',
  ac: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&q=80',
  diagnostics: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&q=80',
  team: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80',
  shop1: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80',
  shop2: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  avatar1: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80',
  avatar2: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80',
  avatar3: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80',
};

const services = [
  {
    title: 'Oil Change',
    description: 'Full synthetic, conventional, and high-mileage oil changes with multi-point inspection.',
    image: images.oilChange,
    icon: '🛢️',
  },
  {
    title: 'Brake Service',
    description: 'Brake pad replacement, rotor resurfacing, and complete brake system diagnostics.',
    image: images.brakes,
    icon: '🛑',
  },
  {
    title: 'Engine Repair',
    description: 'From tune-ups to complete engine overhauls, our ASE-certified techs handle it all.',
    image: images.engine,
    icon: '⚙️',
  },
  {
    title: 'Tire Service',
    description: 'New tire installation, rotation, balancing, and alignment services.',
    image: images.tires,
    icon: '🔧',
  },
  {
    title: 'AC & Heating',
    description: 'Climate control diagnostics, refrigerant recharge, and heating system repairs.',
    image: images.ac,
    icon: '❄️',
  },
  {
    title: 'Diagnostics',
    description: 'State-of-the-art computer diagnostics to identify and solve any issue.',
    image: images.diagnostics,
    icon: '🔍',
  },
];

const testimonials = [
  {
    name: 'Michael Thompson',
    text: "Been bringing my truck here for 5 years. They're honest, fair, and do quality work. Never tried to upsell me on things I didn't need.",
    rating: 5,
    image: images.avatar1,
  },
  {
    name: 'Sarah Mitchell',
    text: "Finally found a shop I can trust! They explained everything clearly and finished the job ahead of schedule. Great customer service.",
    rating: 5,
    image: images.avatar2,
  },
  {
    name: 'David Rodriguez',
    text: "These guys saved me thousands. Other shops wanted to replace my entire transmission, but they diagnosed the real problem. Fixed for a fraction of the cost.",
    rating: 5,
    image: images.avatar3,
  },
];

const whyChooseUs = [
  {
    title: 'ASE Certified Technicians',
    description: 'Our mechanics are nationally certified and undergo continuous training.',
    icon: '🏆',
  },
  {
    title: '24-Month Warranty',
    description: 'All repairs backed by our comprehensive 24-month/24,000-mile warranty.',
    icon: '✅',
  },
  {
    title: 'Honest Pricing',
    description: 'Upfront estimates with no hidden fees. We explain everything before we start.',
    icon: '💰',
  },
  {
    title: 'Same-Day Service',
    description: 'Most repairs completed same day. We respect your time.',
    icon: '⏰',
  },
];

export default function Home() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    vehicle: '',
    service: '',
    message: '',
    preferredDate: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Thank you! We\'ll contact you within 24 hours to confirm your appointment.');
  };

  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#1e3a5f] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-bold text-xl text-[#1e3a5f]">Precision Auto Care</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#services" className="text-gray-600 hover:text-[#1e3a5f] transition">Services</a>
              <a href="#about" className="text-gray-600 hover:text-[#1e3a5f] transition">About</a>
              <a href="#testimonials" className="text-gray-600 hover:text-[#1e3a5f] transition">Reviews</a>
              <a href="#contact" className="text-gray-600 hover:text-[#1e3a5f] transition">Contact</a>
              <a href="tel:8045557890" className="bg-[#f97316] text-white px-5 py-2 rounded-lg font-semibold hover:bg-[#ea580c] transition">
                (804) 555-7890
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center">
        <div className="absolute inset-0 z-0">
          <img
            src={images.hero}
            alt="Precision Auto Care shop"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1e3a5f]/90 to-[#1e3a5f]/60"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-white">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <span className="text-[#f97316]">★</span>
              <span className="text-sm">Serving Richmond, VA Since 2008</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Honest Service.<br/>
              <span className="text-[#f97316]">Expert Care.</span>
            </h1>
            <p className="text-xl text-gray-200 mb-8 leading-relaxed">
              ASE-certified mechanics delivering quality auto repair with transparent pricing. 
              Over 5,000+ vehicles serviced and counting.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#contact"
                className="bg-[#f97316] text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-[#ea580c] transition shadow-lg text-center"
              >
                Schedule Service
              </a>
              <a
                href="tel:8045557890"
                className="bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white/20 transition text-center border border-white/20"
              >
                Call Now: (804) 555-7890
              </a>
            </div>
          </div>
        </div>
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#1e3a5f] mb-4">Our Services</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From routine maintenance to major repairs, we keep Richmond moving.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <div key={index} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition group">
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                  />
                  <div className="absolute top-4 right-4 bg-white rounded-full w-12 h-12 flex items-center justify-center text-2xl shadow-lg">
                    {service.icon}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-[#1e3a5f] mb-2">{service.title}</h3>
                  <p className="text-gray-600">{service.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 bg-[#1e3a5f] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Choose Precision Auto Care?</h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              We're not just another repair shop. We're your partners in keeping your vehicle running its best.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {whyChooseUs.map((item, index) => (
              <div key={index} className="text-center p-6 rounded-2xl bg-white/5 hover:bg-white/10 transition">
                <div className="text-5xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-gray-300">{item.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-[#f97316]">16+</div>
              <div className="text-gray-300">Years in Business</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#f97316]">5,000+</div>
              <div className="text-gray-300">Vehicles Serviced</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#f97316]">4.9★</div>
              <div className="text-gray-300">Average Rating</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#f97316]">100%</div>
              <div className="text-gray-300">Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#1e3a5f] mb-4">What Our Customers Say</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Don't just take our word for it. Here's what Richmond drivers are saying.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-lg">
                <div className="flex gap-1 text-[#f97316] mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-4">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-semibold text-[#1e3a5f]">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">Verified Customer</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-[#1e3a5f] mb-6">About Precision Auto Care</h2>
              <p className="text-lg text-gray-600 mb-6">
                Founded in 2008, Precision Auto Care has been Richmond's trusted auto repair destination 
                for over 16 years. What started as a small two-bay garage has grown into a full-service 
                auto care center, all while maintaining the honest, personal service that built our reputation.
              </p>
              <p className="text-lg text-gray-600 mb-6">
                Every technician on our team is ASE-certified and committed to staying current with 
                the latest automotive technology. We work on all makes and models, from daily drivers 
                to luxury vehicles.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-[#f8fafc] px-4 py-2 rounded-lg">
                  <span className="text-[#f97316]">✓</span>
                  <span className="font-medium">ASE Certified</span>
                </div>
                <div className="flex items-center gap-2 bg-[#f8fafc] px-4 py-2 rounded-lg">
                  <span className="text-[#f97316]">✓</span>
                  <span className="font-medium">Family Owned</span>
                </div>
                <div className="flex items-center gap-2 bg-[#f8fafc] px-4 py-2 rounded-lg">
                  <span className="text-[#f97316]">✓</span>
                  <span className="font-medium">All Makes & Models</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <img
                src={images.team}
                alt="Our team at work"
                className="rounded-2xl shadow-2xl"
              />
              <div className="absolute -bottom-6 -left-6 bg-[#f97316] text-white p-6 rounded-xl shadow-lg">
                <div className="text-3xl font-bold">Est. 2008</div>
                <div className="text-sm opacity-90">Serving Richmond, VA</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hours & Location */}
      <section className="py-24 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-4xl font-bold text-[#1e3a5f] mb-8">Hours & Location</h2>
              <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
                <h3 className="font-bold text-xl text-[#1e3a5f] mb-4">Business Hours</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Monday - Friday</span>
                    <span className="font-semibold text-[#1e3a5f]">7:30 AM - 6:00 PM</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Saturday</span>
                    <span className="font-semibold text-[#1e3a5f]">8:00 AM - 3:00 PM</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">Sunday</span>
                    <span className="font-semibold text-gray-400">Closed</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h3 className="font-bold text-xl text-[#1e3a5f] mb-4">Find Us</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="text-[#f97316] text-xl">📍</span>
                    <div>
                      <div className="font-semibold text-[#1e3a5f]">Address</div>
                      <div className="text-gray-600">1234 Broad Street<br/>Richmond, VA 23220</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-[#f97316] text-xl">📞</span>
                    <div>
                      <div className="font-semibold text-[#1e3a5f]">Phone</div>
                      <a href="tel:8045557890" className="text-[#f97316] hover:underline">(804) 555-7890</a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-[#f97316] text-xl">✉️</span>
                    <div>
                      <div className="font-semibold text-[#1e3a5f]">Email</div>
                      <a href="mailto:service@precisionautocare.com" className="text-[#f97316] hover:underline">
                        service@precisionautocare.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-200 rounded-2xl overflow-hidden h-[500px] shadow-lg">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d100939.98555098464!2d-77.5089!3d37.5407!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89b1115e4a9d3d75%3A0x9f3b5e7b5b5b5b5b!2sRichmond%2C%20VA!5e0!3m2!1sen!2sus!4v1234567890123!5m2!1sen!2sus"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contact" className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#1e3a5f] mb-4">Schedule Your Service</h2>
            <p className="text-xl text-gray-600">
              Fill out the form below and we'll contact you within 24 hours to confirm your appointment.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="bg-[#f8fafc] rounded-2xl p-8 shadow-lg">
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-[#1e3a5f] mb-2">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 outline-none transition"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1e3a5f] mb-2">Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 outline-none transition"
                  placeholder="(804) 555-1234"
                />
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#1e3a5f] mb-2">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 outline-none transition"
                placeholder="john@example.com"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-[#1e3a5f] mb-2">Vehicle *</label>
                <input
                  type="text"
                  required
                  value={formData.vehicle}
                  onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 outline-none transition"
                  placeholder="2020 Honda Accord"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1e3a5f] mb-2">Service Needed *</label>
                <select
                  required
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 outline-none transition bg-white"
                >
                  <option value="">Select a service</option>
                  <option value="oil-change">Oil Change</option>
                  <option value="brakes">Brake Service</option>
                  <option value="engine">Engine Repair</option>
                  <option value="tires">Tire Service</option>
                  <option value="ac">AC & Heating</option>
                  <option value="diagnostics">Diagnostics</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#1e3a5f] mb-2">Preferred Date</label>
              <input
                type="date"
                value={formData.preferredDate}
                onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 outline-none transition"
              />
            </div>
            <div className="mb-8">
              <label className="block text-sm font-semibold text-[#1e3a5f] mb-2">Additional Details</label>
              <textarea
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#f97316] focus:ring-2 focus:ring-[#f97316]/20 outline-none transition resize-none"
                placeholder="Describe any symptoms or specific issues..."
              ></textarea>
            </div>
            <button
              type="submit"
              className="w-full bg-[#f97316] text-white py-4 rounded-lg font-semibold text-lg hover:bg-[#ea580c] transition shadow-lg"
            >
              Request Appointment
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1e3a5f] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                  <span className="text-[#1e3a5f] font-bold text-lg">P</span>
                </div>
                <span className="font-bold text-xl">Precision Auto Care</span>
              </div>
              <p className="text-gray-300 mb-4">
                Honest Service. Expert Care.<br/>
                Serving Richmond since 2008.
              </p>
              <a href="tel:8045557890" className="text-[#f97316] font-semibold text-lg hover:underline">
                (804) 555-7890
              </a>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Services</h4>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#services" className="hover:text-white transition">Oil Changes</a></li>
                <li><a href="#services" className="hover:text-white transition">Brake Service</a></li>
                <li><a href="#services" className="hover:text-white transition">Engine Repair</a></li>
                <li><a href="#services" className="hover:text-white transition">Tire Service</a></li>
                <li><a href="#services" className="hover:text-white transition">AC & Heating</a></li>
                <li><a href="#services" className="hover:text-white transition">Diagnostics</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Hours</h4>
              <ul className="space-y-2 text-gray-300">
                <li>Mon-Fri: 7:30 AM - 6:00 PM</li>
                <li>Saturday: 8:00 AM - 3:00 PM</li>
                <li>Sunday: Closed</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Location</h4>
              <p className="text-gray-300 mb-4">
                1234 Broad Street<br/>
                Richmond, VA 23220
              </p>
              <a
                href="https://maps.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[#f97316] hover:underline"
              >
                Get Directions →
              </a>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              © 2024 Precision Auto Care. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-gray-400 hover:text-white transition">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-white transition">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
