"use client"

import type React from "react"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PhoneInputProps {
  value: string
  countryCode: string
  onChange: (value: string, countryCode: string) => void
  placeholder?: string
  className?: string
}

interface CountryCode {
  code: string
  flag: string
  name: string
}

// Common country codes
const countryCodes: CountryCode[] = [
  { code: "+91", flag: "🇮🇳", name: "India" },
  { code: "+1", flag: "🇺🇸", name: "United States" },
  { code: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+7", flag: "🇷🇺", name: "Russia" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "+60", flag: "🇲🇾", name: "Malaysia" },
  { code: "+66", flag: "🇹🇭", name: "Thailand" },
]

export function PhoneInput({ value, countryCode, onChange, placeholder, className }: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    countryCodes.find((c) => c.code === countryCode) || countryCodes[0],
  )

  const handleCountryChange = (code: string) => {
    const country = countryCodes.find((c) => c.code === code) || countryCodes[0]
    setSelectedCountry(country)
    onChange(value, country.code)
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const phoneValue = e.target.value.replace(/\D/g, "").slice(0, 10)
    onChange(phoneValue, selectedCountry.code)
  }

  return (
    <div className="flex">
      <Select value={selectedCountry.code} onValueChange={handleCountryChange}>
        <SelectTrigger className="w-[120px] backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm rounded-r-none">
          <SelectValue>
            <div className="flex items-center">
              <span className="mr-2 text-lg">{selectedCountry.flag}</span>
              <span className="font-medium">{selectedCountry.code.substring(1)}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {countryCodes.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              <div className="flex items-center">
                <span className="mr-2 text-lg">{country.flag}</span>
                <span className="font-medium">{country.code.substring(1)}</span>
                <span className="ml-2 text-xs text-gray-500">{country.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        value={value}
        onChange={handlePhoneChange}
        placeholder={placeholder || "Phone number"}
        className={`flex-1 rounded-l-none backdrop-blur-sm bg-white/30 border border-gray-200 shadow-sm ${className || ""}`}
      />
    </div>
  )
}
